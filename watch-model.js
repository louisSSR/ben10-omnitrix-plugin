/** Volumetric watch renderer. One solid mesh per generation, viewed by a moving camera.
 * References establish the visible designs, not exact dimensions or hidden mechanisms.
 * Cuff interiors, the lift travel and OV lid-slide path are disclosed modelling interpretations.
 * Coordinates: x along the wrist, y up, z towards the front controls. No image atlases.
 */
const TAU = Math.PI * 2;
const IDS = ['original', 'recalibrated', 'ultimatrix', 'omniverse'];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, n) => a.map(v => v * n);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const n = Math.hypot(...a); return n > 1e-10 ? mul(a, 1 / n) : [0, 1, 0]; };
// RGB stores linear-light material values; the shader converts its final light to display sRGB.
// The fourth component is a material tag, not opacity: rubber / coating / metal / glass / lamp.
// All parts stay opaque and share the same fixed-size vertex format and draw batches.
const C = {
  black: [.032, .040, .047, 1], rubber: [.019, .024, .028, 0], edge: [.11, .14, .16, 2],
  dark: [.029, .040, .055, 1], inner: [.012, .016, .018, 0], silver: [.47, .53, .57, 2],
  white: [.61, .65, .58, 1], green: [.035, .30, .009, 1], lime: [.24, .78, .009, 4],
  light: [.49, 1.0, .07, 4], dim: [.034, .18, .006, 1],
  glass: [.004, .010, .008, 3], steel: [.20, .24, .26, 2], seam: [.003, .005, .006, 0],
};

function part(id, group = 'body') { return { id, group, positions: [], normals: [], colors: [] }; }
function triangle(p, a, b, c, color, na, nb, nc) {
  const n = cross(sub(b, a), sub(c, a));
  if (Math.hypot(...n) < 1e-10) return;
  const face = unit(n);
  p.positions.push(...a, ...b, ...c);
  p.normals.push(...(na || face), ...(nb || na || face), ...(nc || na || face));
  p.colors.push(...color, ...color, ...color);
}
function quad(p, a, b, c, d, color, normals) {
  triangle(p, a, b, c, color, normals?.[0], normals?.[1], normals?.[2]);
  triangle(p, a, c, d, color, normals?.[0], normals?.[2], normals?.[3]);
}

/** A closed revolved profile includes bevels, inner walls and end faces. */
function lathe(id, profile, color, { center = [0, 0, 0], axis = 'y', scale = [1, 1], group = 'body', segments = 64, surfaceColors = null } = {}) {
  const p = part(id, group);
  const point = (r, h, t) => axis === 'x'
    ? add(center, [h, Math.sin(t) * r * scale[0], Math.cos(t) * r * scale[1]])
    : add(center, [Math.cos(t) * r * scale[0], h, Math.sin(t) * r * scale[1]]);
  const normal = (dr, dh, t) => axis === 'x'
    ? unit([-dr, dh * Math.sin(t) / scale[0], dh * Math.cos(t) / scale[1]])
    : unit([dh * Math.cos(t) / scale[0], -dr, dh * Math.sin(t) / scale[1]]);
  for (let j = 0; j < profile.length - 1; j++) {
    const [r0, h0] = profile[j], [r1, h1] = profile[j + 1];
    for (let i = 0; i < segments; i++) {
      const t0 = i * TAU / segments, t1 = (i + 1) * TAU / segments;
      const n0 = normal(r1 - r0, h1 - h0, t0), n1 = normal(r1 - r0, h1 - h0, t1);
      quad(p, point(r0, h0, t0), point(r0, h0, t1), point(r1, h1, t1), point(r1, h1, t0), surfaceColors?.[j] || color, [n0, n1, n1, n0]);
    }
  }
  return p;
}
function ring(id, outer, inner, bottom, top, color, options = {}) {
  const b = Math.min((outer - inner) * .22, (top - bottom) * .3, .035);
  return lathe(id, [[outer - b, bottom], [outer, bottom + b], [outer, top - b], [outer - b, top], [inner + b, top], [inner, top - b], [inner, bottom + b], [inner + b, bottom], [outer - b, bottom]], color, options);
}
function cylinder(id, radius, bottom, top, color, options = {}) {
  const b = Math.min(radius * .08, (top - bottom) * .28, .035);
  return lathe(id, [[0, bottom], [radius - b, bottom], [radius, bottom + b], [radius, top - b], [radius - b, top], [0, top]], color, options);
}

// Small status lamps use recessed domed lenses rather than full-height green cylinders.
function lens(id, radius, bottom, top, color, options = {}) {
  const h = top - bottom;
  return lathe(id, [[0,bottom],[radius*.94,bottom],[radius,bottom+h*.22],
    [radius*.91,bottom+h*.68],[radius*.62,bottom+h*.94],[0,top]], color, {segments:32,...options});
}
function frontLens(id,x,y,z,radius,depth,color,group='body') {
  const sign=Math.sign(depth)||1;
  return transformPart(lens(id,radius,0,Math.abs(depth),color,{group}),
    v=>[v[0]+x,v[2]+y,sign*v[1]+z],n=>[n[0],n[2],sign*n[1]]);
}

// Convex polygon extrusion with a genuine bevel on both broad faces.
function prism(id, polygon, bottom, top, color, { group = 'body', bevel = .025 } = {}) {
  const p = part(id, group);
  const center = polygon.reduce((s, v) => [s[0] + v[0] / polygon.length, s[1] + v[1] / polygon.length], [0, 0]);
  const b = Math.min(bevel, (top - bottom) * .3);
  const inner = polygon.map(v => { const d = sub([v[0], v[1]], center); const l = Math.hypot(...d); const f = Math.max(.5, 1 - b / Math.max(l, .01)); return [center[0] + d[0] * f, center[1] + d[1] * f]; });
  const at = (v, y) => [v[0], y, v[1]];
  const sideQuad = (a, b0, c, d, vertical) => {
    let n=unit(cross(sub(b0,a),sub(c,a)));
    const outward=[(a[0]+b0[0])/2-center[0],vertical,(a[2]+b0[2])/2-center[1]];
    if(dot(n,outward)<0)n=mul(n,-1);
    quad(p,a,b0,c,d,color,[n,n,n,n]);
  };
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    sideQuad(at(inner[i], bottom), at(inner[j], bottom), at(polygon[j], bottom + b), at(polygon[i], bottom + b), -1);
    sideQuad(at(polygon[i], bottom + b), at(polygon[j], bottom + b), at(polygon[j], top - b), at(polygon[i], top - b), 0);
    sideQuad(at(polygon[i], top - b), at(polygon[j], top - b), at(inner[j], top), at(inner[i], top), 1);
    triangle(p, at(center, top), at(inner[j], top), at(inner[i], top), color, [0, 1, 0]);
    triangle(p, at(center, bottom), at(inner[i], bottom), at(inner[j], bottom), color, [0, -1, 0]);
  }
  return p;
}
function box(id, center, size, color, options = {}) {
  const [x, y, z] = center, [w, h, d] = size;
  const c = Math.min(w, d) * .09;
  return prism(id, [[x-w/2+c,z-d/2],[x+w/2-c,z-d/2],[x+w/2,z-d/2+c],[x+w/2,z+d/2-c],[x+w/2-c,z+d/2],[x-w/2+c,z+d/2],[x-w/2,z+d/2-c],[x-w/2,z-d/2+c]], y-h/2, y+h/2, color, options);
}
function transformPart(p, fn, normalFn) {
  for (let i = 0; i < p.positions.length; i += 3) p.positions.splice(i, 3, ...fn(p.positions.slice(i, i + 3)));
  for (let i = 0; i < p.normals.length; i += 3) p.normals.splice(i, 3, ...unit(normalFn(p.normals.slice(i, i + 3))));
  return p;
}
function frontCylinder(id, x, y, z, radius, depth, color, group = 'body') {
  const direction=Math.sign(depth)||1;
  return transformPart(cylinder(id, radius, 0, Math.abs(depth), color, {group}), v => [v[0]+x,v[2]+y,direction*v[1]+z], n => [n[0],n[2],direction*n[1]]);
}

/** Rounded sweep, also used for the broad curved original-generation metal claws. */
function sweep(id, points, width, thickness, color, { group = 'body', side = [1, 0, 0], segments = 12, beveled = false } = {}) {
  const p = part(id, group), rows = [];
  const section=beveled?[[-.78,-1],[.78,-1],[1,-.58],[1,.58],[.78,1],[-.78,1],[-1,.58],[-1,-.58]]:null;
  if(section)segments=section.length;
  for (let i = 0; i < points.length; i++) {
    const tangent = unit(sub(points[Math.min(i+1,points.length-1)], points[Math.max(0,i-1)]));
    let u = unit(sub(side, mul(tangent, dot(side, tangent))));
    if (Math.abs(dot(u, tangent)) > .98) u = unit(cross(tangent, [0, 0, 1]));
    const v = unit(cross(tangent, u));
    rows.push(Array.from({length:segments}, (_, k) => {
      const a = k*TAU/segments, sx=section?section[k][0]:Math.cos(a), sy=section?section[k][1]:Math.sin(a);
      const offset = add(mul(u,sx*width/2),mul(v,sy*thickness/2));
      return {position:add(points[i],offset),normal:unit(add(mul(u,Math.cos(a)/width),mul(v,Math.sin(a)/thickness))),u,v};
    }));
  }
  for(let i=0;i<rows.length-1;i++) for(let k=0;k<segments;k++) {
    const j=(k+1)%segments,a=rows[i][k],b=rows[i][j],c=rows[i+1][j],d=rows[i+1][k];
    let normals=[a.normal,b.normal,c.normal,d.normal];
    if(section) {
      // Keep each bevel edge crisp across the section while shading smoothly along its bend.
      // Flat normals per longitudinal segment would create false shiny horizontal bands.
      const ex=section[j][0]-section[k][0],ey=section[j][1]-section[k][1];
      const at=row=>unit(add(mul(row.u,ey/width),mul(row.v,-ex/thickness)));
      const start=at(a),end=at(d);
      normals=[start,start,end,end];
    }
    quad(p,a.position,b.position,c.position,d.position,color,normals);
  }
  for (let k=0;k<segments;k++) {
    const j=(k+1)%segments;
    triangle(p,points[0],rows[0][j].position,rows[0][k].position,color);
    triangle(p,points.at(-1),rows.at(-1)[k].position,rows.at(-1)[j].position,color);
  }
  return p;
}
const curve = (a,b,c,steps=20) => Array.from({length:steps+1},(_,i)=>{const t=i/steps;return a.map((v,k)=>(1-t)**2*v+2*(1-t)*t*b[k]+t*t*c[k]);});
// A wrist shell is lofted across its width, not the same straight ellipse for every generation.
// Cross-section curvature and the concealed inner return are modelling interpretations.
function wristPoint(shell,x,r,t) {
  const {watch,length,ry,rz}=shell,s=Math.sin(t),c=Math.cos(t);
  const power={original:.77,recalibrated:.85,ultimatrix:.74,omniverse:.73}[watch];
  const nx=clamp(Math.abs(x)/length),middle=1-nx*nx,upper=Math.max(s,0)**2;
  const shape=clamp((r-.77)/.17);
  const q=1+(power-1)*shape,round=v=>Math.sign(v)*Math.abs(v)**q;
  const flare={original:.12,recalibrated:.17,ultimatrix:.018,omniverse:.14}[watch];
  const crown={original:.07,recalibrated:.09,ultimatrix:.035,omniverse:.085}[watch];
  return [x*(1+flare*upper*shape),-.67+round(s)*ry*r*(.98+.02*middle)+crown*middle*upper*shape,
    round(c)*rz*r*(.97+.03*middle)];
}
function wristLoft(id,profile,color,shell,{segments=64,surfaceColors=null}={}) {
  const p=part(id);
  for(let j=0;j<profile.length-1;j++) {
    const [x0,r0]=profile[j],[x1,r1]=profile[j+1];
    const normal=t=>{
      const a=wristPoint(shell,x0,r0,t),b=wristPoint(shell,x1,r1,t);
      const dt=sub(wristPoint(shell,(x0+x1)/2,(r0+r1)/2,t+.001),wristPoint(shell,(x0+x1)/2,(r0+r1)/2,t-.001));
      return unit(cross(sub(b,a),dt));
    };
    for(let i=0;i<segments;i++) {
      const a=i*TAU/segments,b=(i+1)*TAU/segments,na=normal(a),nb=normal(b);
      quad(p,wristPoint(shell,x0,r0,a),wristPoint(shell,x0,r0,b),wristPoint(shell,x1,r1,b),wristPoint(shell,x1,r1,a),surfaceColors?.[j]||color,[na,nb,nb,na]);
    }
  }
  return p;
}
function shapedCuff(shell,color) {
  const l=shell.length;
  const profile=[[-l,.955],[-l+.025,1],[-l*.68,1],[0,1],[l*.68,1],[l-.025,1],[l,.955],
    [l,.77],[l-.035,.74],[0,.74],[-l+.035,.74],[-l,.77],[-l,.955]];
  return wristLoft('cuff-hollow-wall',profile,color,shell,{surfaceColors:[color,color,color,color,color,color,color,C.inner,C.inner,C.inner,C.inner,color]});
}
function shapedBand(id,x0,x1,shell,color) {
  const b=Math.min(.009,(x1-x0)*.24);
  return wristLoft(id,[[x0,1.001],[x0+b,1.018],[x1-b,1.018],[x1,1.001],[x0,1.001]],color,shell,{segments:64});
}

// Subdivide existing solid surfaces before bending: the silhouette gains real curvature,
// rather than shading an unchanged flat box. The deformation keeps normal vectors valid.
function bendSolid(source,height,{steps=3,axis='y'}={}) {
  const p=part(source.id,source.group);
  const shift=v=>axis==='z'?[v[0],v[1],v[2]+height(v[0],v[1])]:[v[0],v[1]+height(v[0],v[2]),v[2]];
  const shade=(v,n)=>{
    const e=.0005,q=axis==='z'?v[1]:v[2];
    const dx=(height(v[0]+e,q)-height(v[0]-e,q))/(2*e),dq=(height(v[0],q+e)-height(v[0],q-e))/(2*e);
    return axis==='z'?unit([n[0]-dx*n[2],n[1]-dq*n[2],n[2]]):unit([n[0]-dx*n[1],n[1],n[2]-dq*n[1]]);
  };
  for(let i=0;i<source.positions.length;i+=9) {
    const a=source.positions.slice(i,i+3),b=source.positions.slice(i+3,i+6),c=source.positions.slice(i+6,i+9);
    const na=source.normals.slice(i,i+3),nb=source.normals.slice(i+3,i+6),nc=source.normals.slice(i+6,i+9);
    const color=source.colors.slice(i/3*4,i/3*4+4);
    const vertex=(u,v)=>({pos:add(a,add(mul(sub(b,a),u),mul(sub(c,a),v))),normal:unit(add(na,add(mul(sub(nb,na),u),mul(sub(nc,na),v))))});
    const emit=(q,r,s)=>triangle(p,shift(q.pos),shift(r.pos),shift(s.pos),color,shade(q.pos,q.normal),shade(r.pos,r.normal),shade(s.pos,s.normal));
    for(let u=0;u<steps;u++) for(let v=0;v<steps-u;v++) {
      const a0=vertex(u/steps,v/steps),b0=vertex((u+1)/steps,v/steps),c0=vertex(u/steps,(v+1)/steps);
      emit(a0,b0,c0);
      if(u+v<steps-1)emit(b0,vertex((u+1)/steps,(v+1)/steps),c0);
    }
  }
  return p;
}

// The folded seat has a real round well. A solid pitched diamond would cover the retracted dial.
function diamondSeat(id,rx,rz,hole,bottom,top,color,height) {
  const p=part(id),segments=64,profile=[[1,bottom],[1,top],[0,top],[0,bottom],[1,bottom]];
  const point=(k,y,t)=>{
    const cs=Math.cos(t),sn=Math.sin(t),outer=1/(Math.abs(cs)/rx+Math.abs(sn)/rz);
    const r=hole+(outer-hole)*k,x=r*cs,z=r*sn;
    return [x,y+height(x,z),z];
  };
  for(let j=0;j<profile.length-1;j++) {
    const [k0,y0]=profile[j],[k1,y1]=profile[j+1];
    const normal=t=>{
      const dt=sub(point((k0+k1)/2,(y0+y1)/2,t+.001),point((k0+k1)/2,(y0+y1)/2,t-.001));
      return unit(cross(sub(point(k1,y1,t),point(k0,y0,t)),dt));
    };
    for(let i=0;i<segments;i++) {
      const a=i*TAU/segments,b=(i+1)*TAU/segments,na=normal(a),nb=normal(b);
      quad(p,point(k0,y0,a),point(k0,y0,b),point(k1,y1,b),point(k1,y1,a),color,[na,nb,nb,na]);
    }
  }
  return p;
}

function faceSymbol(parts, cx, y, radius, color, group='core') {
  for (const sign of [-1,1]) parts.push(prism(`hourglass-${sign}`,[[cx-radius*.72,sign*radius*.74],[cx+radius*.72,sign*radius*.74],[cx+radius*.16,0],[cx-radius*.16,0]],y,y+.009,color,{group,bevel:0}));
}
function coreMarks(parts,cx,radius,bottom,top) {
  for(let i=0;i<8;i++) {
    const t=i*TAU/8, radial=[Math.cos(t),0,Math.sin(t)], tangent=[-Math.sin(t),0,Math.cos(t)];
    const coords=[[-.055,bottom],[.025,bottom],[.025,(bottom+top)/2-.018],[.065,(bottom+top)/2+.012],[.065,top],[-.015,top],[-.015,(bottom+top)/2+.02],[-.055,(bottom+top)/2-.018]];
    const p=part(`core-green-mark-${i}`,'core');
    // A slender bent strip consists of independent surface quads, not speculative text.
    for(const q of [[0,1,2,7],[7,2,3,6],[6,3,4,5]]) {
      const ps=q.map(j=>add([cx,coords[j][1],0],add(mul(radial,radius),mul(tangent,coords[j][0]))));
      quad(p,...ps,C.lime,[radial,radial,radial,radial]);
    }
    parts.push(p);
  }
}

/** Pure geometry construction. Positions are the closed pose; groups carry rigid motion. */
export function buildWatchGeometry(watchId='original') {
  const watch=IDS.includes(watchId)?watchId:'original', parts=[];
  const ua=watch==='ultimatrix', ov=watch==='omniverse', af=watch==='recalibrated', original=watch==='original';
  const cx=ua?.54:0, r=ov?.455:af?.52:ua?.60:.57;
  // The original's broad bezel stays fixed; only its smaller central emitter rises.
  // This separation, clearance and travel are an art-directed mechanism, not an official blueprint.
  const coreRadius=original?.44:r;
  const top=ov?.30:af?.31:ua?.31:.34;
  const lift=ov?.35:af?.33:ua?.30:.32;
  const ry=ua?.71:ov?.73:af?.65:.71, rz=ua?.67:ov?.75:af?.63:.75;
  const length=ua?1.23:ov?.59:af?.38:.49;
  const shell={watch,length,ry,rz};
  parts.push(shapedCuff(shell,ov?C.white:af||ua?C.green:C.rubber));
  const rimWidth=watch==='original'?.10:.04;
  parts.push(shapedBand('cuff-front-rim',length-rimWidth,length+.018,shell,ov||ua?C.green:af?C.edge:C.steel));
  parts.push(shapedBand('cuff-back-rim',-length-.018,-length+rimWidth,shell,ov||ua?C.green:af?C.edge:C.steel));
  // Shallow moulding seams stay on the existing cuff; no speculative switches or armour plates.
  for(const side of [-1,1]) {
    const x=side*(length-rimWidth-.027);
    parts.push(shapedBand(`cuff-moulding-seam-${side}`,x-.003,x+.003,shell,C.seam));
  }
  if(af) parts.push(shapedBand('green-band-black-centre',-.105,.105,shell,C.black));
  if(!ua&&!ov) {
    parts.push(lathe('case-lower-cushion',[[0,-.095],[r+.10,-.095],[r+.185,-.055],[r+.205,.005],[r+.195,.065],[r+.15,.10],[0,.10]],C.black));
    parts.push(lathe('case-base-beveled-rim',[[r+.17,.025],[r+.20,.055],[r+.19,.098],[r+.14,.16],[r-.06,.16],[r-.06,.025],[r+.17,.025]],af?C.green:C.edge));
    if(original) {
      // Wide dark fixed shoulder, with a recessed inner socket around the moving cap.
      // Its inner radius clears every core part throughout the unchanged lift stroke.
      parts.push(lathe('fixed-core-collar',[[.686,.115],[.713,.145],[.718,.205],[.705,.263],[.678,.302],
        [.535,.315],[.508,.294],[.505,.267],[.505,.115],[.686,.115]],C.black,
        {surfaceColors:[C.dark,C.black,C.black,C.black,C.black,C.edge,C.seam,C.seam,C.dark]}));
      parts.push(ring('fixed-bezel-inner-joint',.529,.504,.282,.294,C.seam));
      parts.push(ring('fixed-bezel-lower-joint',.719,.710,.178,.190,C.seam));
    } else {
      parts.push(lathe('fixed-core-collar',[[r+.145,.12],[r+.155,.148],[r+.13,.19],[r+.09,.245],[r-.025,.245],[r-.025,.12],[r+.145,.12]],C.dark));
    }
  }
  if(watch==='original') {
    for(let i=0;i<4;i++) {
      const t=Math.PI/4+i*Math.PI/2, cs=Math.cos(t),sn=Math.sin(t);
      const bend=curve([cs*.65,.18,sn*.65],[cs*.98,.24,sn*1.07],[cs*.76,-.28,sn*.97],28);
      // A thin dark seat separates each curved silver hook from the cuff and fixed case.
      parts.push(sweep(`silver-claw-seat-${i}`,bend.map(([x,y,z])=>[x,y-.016,z]),.272,.085,C.seam,{side:[-sn,0,cs],beveled:true}));
      parts.push(sweep(`curved-silver-claw-${i}`,bend,.250,.088,C.silver,{side:[-sn,0,cs],beveled:true}));
    }
    parts.push(frontCylinder('large-side-button-gasket',.16,-.025,.744,.181,.028,C.seam));
    parts.push(frontCylinder('large-side-button-bezel',.16,-.025,.765,.163,.095,C.silver));
    parts.push(frontCylinder('large-side-button-inset',.16,-.025,.858,.129,.010,C.black));
    parts.push(frontLens('large-side-button-green',.16,-.025,.866,.111,.032,C.lime));
  }
  if(af) {
    for(const s of [-1,1]) {
      parts.push(frontCylinder(`lateral-control-${s}`,0,.13,s*.62,.108,s*.18,C.dark));
      parts.push(frontCylinder(`lateral-control-seat-${s}`,0,.13,s*.797,.078,s*.011,C.seam));
      parts.push(frontLens(`lateral-control-green-${s}`,0,.13,s*.805,.063,s*.018,C.lime));
    }
    const arc=Array.from({length:23},(_,i)=>{const t=.40+i/22*2.35;return[Math.cos(t)*.665,.055,Math.sin(t)*.665];});
    parts.push(sweep('lower-front-silver-arc',arc,.095,.055,C.silver,{side:[0,1,0],beveled:true}));
  }
  if(ua) {
    const hood=[[-1.18,-.46],[-1.05,-.57],[.50,-.65],[.91,-.56],[1.14,-.34],[1.22,0],[1.14,.34],[.91,.56],[.50,.65],[-1.05,.57],[-1.18,.46]];
    const hoodCurve=(x,z)=>.045*(1-(z/.67)**2)-.055*Math.max(0,(-x-.45)/.75)**2;
    parts.push(bendSolid(prism('elongated-upper-bracer',hood,-.115,.135,C.green,{bevel:.045}),hoodCurve,{steps:4}));
    parts.push(bendSolid(box('rear-dark-panel',[-.69,.155,0],[.67,.025,.72],C.dark,{bevel:.012}),hoodCurve,{steps:3}));
    parts.push(ring('offset-silver-core-collar',r+.13,r-.055,.115,.265,C.silver,{center:[cx,0,0]}));
    // The visible side panel and its two independent pipes follow the same solid wrist surface.
    // This keeps the upper pipe seated instead of hovering over a flat vertical sticker.
    const sideZ=(x,y)=>{
      let a=0,b=Math.PI/2;
      for(let i=0;i<14;i++){const mid=(a+b)/2;if(wristPoint(shell,x,1,mid)[1]<y)a=mid;else b=mid;}
      return wristPoint(shell,x,1,(a+b)/2)[2];
    };
    parts.push(bendSolid(box('near-side-dark-inlay',[-.11,-.28,.616],[1.89,.40,.045],C.dark,{bevel:.02}),
      (x,y)=>sideZ(x,y)-.616+.010,{steps:4,axis:'z'}));
    const pipeA=[[-.93,-.27,.668],[-.85,-.37,.686],[-.70,-.40,.693],[-.52,-.39,.699],[.29,-.19,.672],[.40,-.10,.653]];
    const pipeB=[[-1.04,-.49,.61],[-.62,-.46,.68],[.10,-.33,.701],[.46,-.19,.674],[.57,-.09,.65]];
    for(const [i,points] of [pipeA,pipeB].entries()) {
      for(const p of points)p[2]=sideZ(p[0],p[1])+.065;
      parts.push(sweep(`independent-side-pipe-${i}`,points,.075,.075,C.lime,{side:[0,0,1]}));
      for(const [j,p] of [points[0],points.at(-1)].entries()) {
        parts.push(frontCylinder(`pipe-end-coupler-${i}-${j}`,p[0],p[1],p[2]-.023,.060,.046,C.silver));
        parts.push(frontLens(`pipe-end-inset-${i}-${j}`,p[0],p[1],p[2]+.022,.036,.011,C.lime));
      }
    }
  }
  if(ov) {
    // Cover and seat share a pitched surface, with a small seated overlap in the closed pose.
    // The original slide distance remains an interaction interpretation, not a canonical hinge.
    const roof=(x,z)=>.105*Math.max(0,1-Math.abs(z)/.70)-.016*Math.min(1,Math.abs(x)/.84);
    parts.push(bendSolid(prism('shallow-diamond-support',[[-.84,0],[0,-.70],[.84,0],[0,.70]],.035,.14,C.green,{bevel:.026}),roof,{steps:3}));
    parts.push(diamondSeat('black-faceted-diamond-frame',.78,.645,r+.030,.10,.25,C.black,roof));
    parts.push(ring('small-black-core-collar',r+.085,r-.04,.17,.255,C.dark));
    const lids=[{id:'left',poly:[[-.75,0],[0,-.62],[0,0],[0,.62]]},{id:'right',poly:[[.75,0],[0,.62],[0,0],[0,-.62]]}];
    for(const lid of lids) {
      parts.push(bendSolid(prism(`green-lid-rim-${lid.id}`,lid.poly,.247,.30,C.green,{group:`lid-${lid.id}`,bevel:.014}),roof,{steps:3}));
      const poly=lid.poly.map(([x,z])=>[x*.93,z*.91]);
      parts.push(bendSolid(prism(`black-lid-panel-${lid.id}`,poly,.293,.351,C.black,{group:`lid-${lid.id}`,bevel:.015}),roof,{steps:3}));
    }
    for(let i=0;i<3;i++) parts.push(box(`three-front-green-markers-${i}`,[-.17+i*.17,-.15,.758],[.09,.09,.028],C.green,{bevel:.006}));
  }
  const coreCenter=[cx,0,0],cr=coreRadius;
  // The shaft is retained inside the socket when closed and overlaps its fixed collar even at full lift.
  // Its -0.11 lower end stays above the cuff's inner roof, avoiding a piston through the wrist cavity.
  parts.push(cylinder('independent-lift-core',cr+.025,-.11,top-.045,C.dark,{center:coreCenter,group:'core'}));
  parts.push(ring('core-lower-seal',cr+.04,cr-.025,.09,.13,C.black,{center:coreCenter,group:'core'}));
  if(af||ov) coreMarks(parts,cx,cr+.027,.14,top-.07);
  if(original) {
    // Eight inset vertical emission slots use capsule outlines; no speculative writing or screws.
    const capsule=(halfWidth,bottom,top)=>Array.from({length:18},(_,j)=>{
      const a=(j<=8?j:j-1)*Math.PI/8;
      return [Math.cos(a)*halfWidth,(j<=8?top-halfWidth:bottom+halfWidth)+Math.sin(a)*halfWidth];
    });
    for(let i=0;i<8;i++) {
      const t=i*TAU/8,cs=Math.cos(t),sn=Math.sin(t);
      const slot=(id,halfWidth,bottom,top,depth,color)=>transformPart(
        prism(id,capsule(halfWidth,bottom,top),0,depth,color,{group:'core',bevel:.0015}),
        v=>[cx+cs*(cr+.026+v[1])-sn*v[0],v[2],sn*(cr+.026+v[1])+cs*v[0]],
        n=>[cs*n[1]-sn*n[0],n[2],sn*n[1]+cs*n[0]]);
      parts.push(slot(`core-vertical-slot-seat-${i}`,.027,.000,.266,.003,C.seam));
      parts.push(slot(`core-vertical-slot-green-${i}`,.016,.015,.251,.006,C.lime));
    }
  }
  parts.push(ring('core-face-beveled-rim',cr+.055,cr-.048,top-.075,top+.015,ua?C.silver:original?C.black:C.edge,{center:coreCenter,group:'core'}));
  // The original has a slim silver inner lip inside a dark crown, not a broad silver lid.
  parts.push(ring('core-rim-polished-lip',original?cr-.022:cr+.047,cr-.043,top+.009,top+.019,ua||original?C.silver:af?C.dark:C.black,{center:coreCenter,group:'core',segments:48}));
  parts.push(ring('core-face-inner-gasket',cr-.043,cr-.055,top+.003,top+.011,C.seam,{center:coreCenter,group:'core',segments:48}));
  parts.push(ring('core-rim-lower-joint',cr+.056,cr+.041,top-.064,top-.053,C.seam,{center:coreCenter,group:'core',segments:48}));
  parts.push(cylinder('inset-face-glass',cr-.043,top-.022,top+.006,C.glass,{center:coreCenter,group:'core'}));
  faceSymbol(parts,cx,top+.008,cr-.075,C.lime);
  if(original) for(let i=0;i<4;i++) {
    const t=i*Math.PI/2,center=[cx+Math.cos(t)*.625,0,Math.sin(t)*.625];
    parts.push(cylinder(`four-status-light-seat-${i}`,.085,.282,.326,C.black,{center,segments:32}));
    parts.push(ring(`four-status-light-bezel-${i}`,.077,.057,.317,.341,C.edge,{center,segments:32}));
    parts.push(lens(`four-status-light-green-${i}`,.056,.331,.379,C.lime,{center}));
  }
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of parts) {
    for(let i=0;i<p.positions.length;i++) {min[i%3]=Math.min(min[i%3],p.positions[i]);max[i%3]=Math.max(max[i%3],p.positions[i]);}
    p.positions=new Float32Array(p.positions);p.normals=new Float32Array(p.normals);p.colors=new Float32Array(p.colors);
  }
  return {watch,parts,face:{center:[cx,top+.021,0],radius:coreRadius-.052},lift,bounds:{min,max}};
}

export function watchPose(state={}) {
  const watch=IDS.includes(state.watch)?state.watch:'original';
  const presets={top:[0,79],left:[-42,41],low:[-20,21],right:[43,40]};
  const dial=state.mode==='dial',view=presets[state.view]||presets.left;
  const raised=dial?0:clamp(typeof state.raised==='number'?state.raised:state.raised?1:0);
  const lift={original:.32,recalibrated:.33,ultimatrix:.30,omniverse:.35}[watch];
  return {watch,azimuth:(dial?0:view[0])*Math.PI/180,elevation:(dial?90:view[1])*Math.PI/180,distance:watch==='ultimatrix'?6.10:watch==='omniverse'?5.00:4.30,target:[watch==='ultimatrix'?.54:0,-.30,0],lift:raised*lift,lidSlide:watch==='omniverse'?(dial?.47:raised*.47):0,fov:38*Math.PI/180};
}
function camera(pose,aspect=1) {
  const {azimuth:a,elevation:e,distance:d,target}=pose;
  const back=[Math.cos(e)*Math.sin(a),Math.sin(e),Math.cos(e)*Math.cos(a)];
  const right=[Math.cos(a),0,-Math.sin(a)],up=unit(cross(back,right)),eye=add(target,mul(back,d));
  const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-dot(right,eye),-dot(up,eye),-dot(back,eye),1]);
  const f=1/Math.tan(pose.fov/2),near=.1,far=25;
  const proj=[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
  const matrix=new Float32Array(16);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)matrix[col*4+row]+=proj[k*4+row]*view[col*4+k];
  return {eye,right,up,back,matrix,f};
}
function project(point,pose,aspect=1) {
  const c=camera(pose,aspect),delta=sub(point,c.eye),depth=-dot(delta,c.back);
  return {x:.5+dot(delta,c.right)*c.f/(2*aspect*depth),y:.5-dot(delta,c.up)*c.f/(2*depth),depth};
}
/** Face center and ellipse axes in canvas fractions; angle a is CSS clockwise degrees. */
export function projectWatchFace(geometry,pose,aspect=1) {
  const center=add(geometry.face.center,[0,pose.lift,0]),p=project(center,pose,aspect),r=geometry.face.radius;
  const x1=project(add(center,[r,0,0]),pose,aspect),x0=project(add(center,[-r,0,0]),pose,aspect);
  const z1=project(add(center,[0,0,r]),pose,aspect),z0=project(add(center,[0,0,-r]),pose,aspect);
  const ux=(x1.x-x0.x)/2,uy=(x1.y-x0.y)/2,vx=(z1.x-z0.x)/2,vy=(z1.y-z0.y)/2;
  const aa=ux*ux+vx*vx,bb=ux*uy+vx*vy,dd=uy*uy+vy*vy;
  const disc=Math.sqrt((aa-dd)**2+4*bb*bb),major=Math.sqrt(Math.max(0,(aa+dd+disc)/2)),minor=Math.sqrt(Math.max(0,(aa+dd-disc)/2));
  // A circle has no preferred major axis. Round-off can swap aa/dd and rotate its content 90°.
  // Use a relative eigenvalue-gap tolerance so small and large projected dials behave alike.
  const nearCircle=disc<=(aa+dd)*1e-6;
  const angle=nearCircle?0:Math.abs(bb)<1e-10?(aa>=dd?0:Math.PI/2):Math.atan2(2*bb,aa-dd)/2;
  return {x:p.x,y:p.y,w:major*2,h:minor*2,a:angle*180/Math.PI,ellipseRatio:major>0?minor/major:1,visible:p.depth>0&&p.x>0&&p.x<1&&p.y>0&&p.y<1};
}

const VERTEX=`attribute vec3 aPosition; attribute vec3 aNormal; attribute vec4 aColor;
uniform mat4 uViewProjection; uniform vec3 uOffset;
varying vec3 vWorld; varying vec3 vNormal; varying vec4 vColor;
void main(){vWorld=aPosition+uOffset;vNormal=aNormal;vColor=aColor;gl_Position=uViewProjection*vec4(vWorld,1.0);}`;
const FRAGMENT=`precision mediump float;
varying vec3 vWorld;varying vec3 vNormal;varying vec4 vColor;uniform vec3 uEye;
// Fixed studio panels are an analytic lighting approximation, not a sampled environment map.
// No textures, noise, frame time, extra draw passes or continuously running animation are needed.
vec3 linearToDisplay(vec3 c){
  vec3 low=c*12.92,high=1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055;
  return mix(low,high,step(vec3(0.0031308),c));
}
void main(){
  vec3 n=normalize(vNormal),v=normalize(uEye-vWorld),base=vColor.rgb;
  float metal=step(1.5,vColor.a)*(1.0-step(2.5,vColor.a));
  float glass=step(2.5,vColor.a)*(1.0-step(3.5,vColor.a));
  float lamp=step(3.5,vColor.a),rubber=1.0-step(0.5,vColor.a);
  vec3 key=normalize(vec3(-0.65,1.0,0.85)),fill=normalize(vec3(0.8,0.28,-0.6));
  float ndv=max(dot(n,v),0.0),ndk=max(dot(n,key),0.0),ndf=max(dot(n,fill),0.0);
  float fresnel=pow(1.0-ndv,5.0);
  // A darker underside and stronger key separate the solid shoulder from its inner wrist cavity.
  // This is a studio-light approximation, not contact-shadow or ambient-occlusion simulation.
  float cavity=(0.58+0.42*smoothstep(-1.35,0.02,vWorld.y))*(0.60+0.40*smoothstep(-0.75,0.12,n.y));
  float diffuse=0.085+0.12*(n.y*0.5+0.5)+0.94*ndk+0.08*ndf;
  vec3 reflected=reflect(-v,n);
  float broadPanel=smoothstep(0.35,0.97,dot(reflected,normalize(vec3(-0.55,0.85,0.35))));
  float edgePanel=smoothstep(0.80,0.98,dot(reflected,normalize(vec3(0.72,0.32,0.65))));
  float exponent=mix(mix(32.0,72.0,metal),112.0,max(glass,lamp));
  float highlight=pow(max(dot(n,normalize(key+v)),0.0),exponent);
  float specular=0.07+0.40*metal+0.40*glass+0.28*lamp-0.055*rubber;
  float reflection=(0.04+0.68*metal+0.23*glass)*(1.0-rubber);
  vec3 tint=mix(vec3(0.84,0.92,1.0),base*0.45+vec3(0.55),metal);
  vec3 rgb=base*diffuse*cavity*(1.0-0.17*metal);
  rgb+=tint*(highlight*specular+(broadPanel*0.48+edgePanel*0.32)*reflection);
  rgb+=vec3(0.55,0.68,0.75)*fresnel*(0.045+0.13*metal+0.24*glass)*(1.0-rubber);
  rgb=mix(rgb,base*(0.62+0.34*ndk)+vec3(0.72,0.95,0.47)*highlight*0.28,lamp);
  // A mild highlight shoulder keeps bright metal below clipped white; dark values keep contrast.
  rgb=rgb/(vec3(1.0)+rgb*0.45);
  gl_FragColor=vec4(clamp(linearToDisplay(rgb),0.0,1.0),1.0);
}`;

/** Event-driven renderer: no idle animation loop; disposal releases all owned resources. */
export function createWatchModel(canvas,{onFrame=()=>{},onUnavailable=()=>{}}={}) {
  if(!canvas||typeof canvas.getContext!=='function')return null;
  let gl;
  try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,depth:true,preserveDrawingBuffer:false});}catch{return null;}
  if(!gl||typeof gl.createShader!=='function')return null;
  let program=null,buffers=[],disposed=false,frame=0,resizeObserver=null;
  const win=canvas.ownerDocument?.defaultView||globalThis;
  const raf=typeof win.requestAnimationFrame==='function'?win.requestAnimationFrame.bind(win):null;
  const cancel=typeof win.cancelAnimationFrame==='function'?win.cancelAnimationFrame.bind(win):()=>{};
  if(!raf)return null;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw new Error('Watch shader compilation failed');}return s;}
  let vertex,fragment;
  try{vertex=shader(gl.VERTEX_SHADER,VERTEX);fragment=shader(gl.FRAGMENT_SHADER,FRAGMENT);program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Watch program link failed');}
  catch{if(program)gl.deleteProgram(program);if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);return null;}
  gl.deleteShader(vertex);gl.deleteShader(fragment);
  const locations={position:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal'),color:gl.getAttribLocation(program,'aColor'),matrix:gl.getUniformLocation(program,'uViewProjection'),offset:gl.getUniformLocation(program,'uOffset'),eye:gl.getUniformLocation(program,'uEye')};
  let state={watch:'original',view:'left',raised:false,reducedMotion:false,visible:true,mode:'projection'};
  let geometry=null,current=watchPose(state),transition=null;
  let lastW=0,lastH=0;
  const now=()=>win.performance?.now?.()??Date.now();
  function releaseBuffers(){for(const b of buffers)gl.deleteBuffer(b.buffer);buffers=[];}
  function upload(watch){
    releaseBuffers();geometry=buildWatchGeometry(watch);
    for(const group of ['body','core','lid-left','lid-right']){
      const pieces=geometry.parts.filter(p=>p.group===group);if(!pieces.length)continue;
      const count=pieces.reduce((n,p)=>n+p.positions.length/3,0),data=new Float32Array(count*10);let offset=0;
      for(const p of pieces)for(let i=0;i<p.positions.length/3;i++){
        data.set(p.positions.subarray(i*3,i*3+3),offset);data.set(p.normals.subarray(i*3,i*3+3),offset+3);data.set(p.colors.subarray(i*4,i*4+4),offset+6);offset+=10;
      }
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);buffers.push({group,buffer,count});
    }
  }
  function sample(time){
    if(!transition)return current;
    const t=clamp((time-transition.start)/transition.duration),e=t*t*(3-2*t),a=transition.from,b=transition.to;
    current={watch:b.watch,target:b.target.map((v,i)=>a.target[i]+(v-a.target[i])*e)};
    for(const k of ['azimuth','elevation','distance','lift','lidSlide','fov'])current[k]=a[k]+(b[k]-a[k])*e;
    if(t>=1)transition=null;
    return current;
  }
  function requestDraw(){if(!disposed&&state.visible&&!frame)frame=raf(draw);}
  function draw(time){
    frame=0;if(disposed||!state.visible)return;sample(time);
    const rect=canvas.getBoundingClientRect?.();const cssW=rect?.width||canvas.clientWidth||1,cssH=rect?.height||canvas.clientHeight||1;
    if(cssW<2||cssH<2)return;
    const dpr=Math.min(win.devicePixelRatio||1,2.25,1440/Math.max(cssW,cssH));
    const width=Math.max(1,Math.round(cssW*dpr)),height=Math.max(1,Math.round(cssH*dpr));
    if(width!==lastW||height!==lastH){canvas.width=width;canvas.height=height;lastW=width;lastH=height;}
    const aspect=width/height,c=camera(current,aspect);
    gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.useProgram(program);
    gl.uniformMatrix4fv(locations.matrix,false,c.matrix);gl.uniform3fv(locations.eye,c.eye);
    for(const b of buffers){
      gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);
      for(const [location,size,offset] of [[locations.position,3,0],[locations.normal,3,12],[locations.color,4,24]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,40,offset);}
      const offset=b.group==='core'?[0,current.lift,0]:b.group==='lid-left'?[-current.lidSlide,0,0]:b.group==='lid-right'?[current.lidSlide,0,0]:[0,0,0];
      gl.uniform3fv(locations.offset,offset);gl.drawArrays(gl.TRIANGLES,0,b.count);
    }
    onFrame({...projectWatchFace(geometry,current,aspect),watch:state.watch,coreLift:current.lift,transitioning:!!transition,vertexCount:buffers.reduce((n,b)=>n+b.count,0)});
    if(transition)requestDraw();
  }
  function setState(next={}){
    if(disposed)return;
    const time=now();sample(time);
    const previous=state;state={...state,...next};state.watch=IDS.includes(state.watch)?state.watch:'original';
    if(!['top','left','low','right'].includes(state.view))state.view='left';
    if(!geometry||geometry.watch!==state.watch)upload(state.watch);
    const target=watchPose(state);
    const changed=['azimuth','elevation','distance','lift','lidSlide','fov'].some(k=>Math.abs(current[k]-target[k])>1e-7)||current.watch!==target.watch;
    if(state.reducedMotion||!previous.visible){current=target;transition=null;}
    else if(changed)transition={from:{...current,target:[...current.target]},to:target,start:time,duration:440};
    if(!state.visible){if(frame)cancel(frame);frame=0;current=target;transition=null;return;}
    requestDraw();
  }
  function dispose(){if(disposed)return;disposed=true;if(frame)cancel(frame);frame=0;resizeObserver?.disconnect();canvas.removeEventListener?.('webglcontextlost',contextLost);win.removeEventListener?.('resize',requestDraw);releaseBuffers();if(program)gl.deleteProgram(program);program=null;transition=null;}
  function contextLost(event){event.preventDefault?.();dispose();onUnavailable('context-lost');}
  canvas.addEventListener?.('webglcontextlost',contextLost,false);
  if(typeof win.ResizeObserver==='function'){resizeObserver=new win.ResizeObserver(requestDraw);resizeObserver.observe(canvas);}
  else win.addEventListener?.('resize',requestDraw);
  // No synchronous callbacks during factory construction. Root calls setState after binding.
  return {setState,dispose};
}
