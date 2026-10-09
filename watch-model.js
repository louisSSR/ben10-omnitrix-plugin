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
function cuff(id, halfLength, ry, rz, color) {
  return lathe(id, [[.94,-halfLength],[1,-halfLength+.045],[1,halfLength-.045],[.94,halfLength],[.77,halfLength],[.74,halfLength-.035],[.74,-halfLength+.035],[.77,-halfLength],[.94,-halfLength]],color,{axis:'x',center:[0,-.67,0],scale:[ry,rz],surfaceColors:[color,color,color,color,C.inner,C.inner,C.inner,color]});
}
function cuffBand(id, x0, x1, ry, rz, color) {
  return ring(id,1.015,.975,x0,x1,color,{axis:'x',center:[0,-.67,0],scale:[ry,rz]});
}
function cuffSeam(id,x,ry,rz) {
  return ring(id,1.008,.997,x-.004,x+.004,C.seam,{axis:'x',center:[0,-.67,0],scale:[ry,rz],segments:48});
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
  const ua=watch==='ultimatrix', ov=watch==='omniverse', af=watch==='recalibrated';
  const cx=ua?.54:0, r=ov?.455:af?.52:ua?.60:.57;
  const top=ov?.30:af?.31:ua?.31:.34;
  const lift=ov?.35:af?.33:ua?.30:.32;
  const ry=ua?.71:ov?.73:af?.65:.71, rz=ua?.67:ov?.75:af?.63:.75;
  const length=ua?1.23:ov?.59:af?.38:.49;
  parts.push(cuff('cuff-hollow-wall',length,ry,rz,ov?C.white:af||ua?C.green:C.rubber));
  const rimWidth=watch==='original'?.10:.04;
  parts.push(cuffBand('cuff-front-rim',length-rimWidth,length+.018,ry,rz,ov?C.green:ua?C.green:af?C.edge:C.steel));
  parts.push(cuffBand('cuff-back-rim',-length-.018,-length+rimWidth,ry,rz,ov?C.green:ua?C.green:af?C.edge:C.steel));
  // Shallow moulding seams stay on the existing cuff; no speculative switches or armour plates.
  for(const side of [-1,1]) parts.push(cuffSeam(`cuff-moulding-seam-${side}`,side*(length-rimWidth-.027),ry,rz));
  if(af) parts.push(cuffBand('green-band-black-centre',-.095,.095,ry+.008,rz+.008,C.black));
  if(!ua&&!ov) {
    parts.push(cylinder('case-lower-cushion',r+.20,-.08,.09,C.black));
    parts.push(ring('case-base-beveled-rim',r+.18,r-.06,.055,.16,af?C.green:C.edge));
    parts.push(ring('fixed-core-collar',r+.13,r-.025,.13,.245,af?C.dark:C.black));
  }
  if(watch==='original') {
    for(let i=0;i<4;i++) {
      const t=Math.PI/4+i*Math.PI/2, cs=Math.cos(t),sn=Math.sin(t);
      parts.push(sweep(`curved-silver-claw-${i}`,curve([cs*.64,.16,sn*.64],[cs*1.06,.20,sn*1.06],[cs*.91,-.47,sn*.91]),.225,.080,C.silver,{side:[-sn,0,cs],beveled:true}));
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
    parts.push(box('elongated-upper-bracer',[0,-.01,0],[2.35,.25,1.16],C.green,{bevel:.06}));
    parts.push(box('rear-dark-panel',[-.69,.128,0],[.67,.032,.72],C.dark,{bevel:.025}));
    parts.push(ring('offset-silver-core-collar',r+.13,r-.055,.115,.265,C.silver,{center:[cx,0,0]}));
    // The observed side uses two separate pipes; the back remains a restrained plain cuff.
    parts.push(box('near-side-dark-inlay',[-.11,-.28,.616],[1.89,.40,.045],C.dark,{bevel:.035}));
    const pipeA=[[-.93,-.27,.668],[-.85,-.37,.686],[-.70,-.40,.693],[-.52,-.39,.699],[.29,-.19,.672],[.40,-.10,.653]];
    const pipeB=[[-1.04,-.49,.61],[-.62,-.46,.68],[.10,-.33,.701],[.46,-.19,.674],[.57,-.09,.65]];
    for(const [i,points] of [pipeA,pipeB].entries()) {
      parts.push(sweep(`independent-side-pipe-${i}`,points,.075,.075,C.lime,{side:[0,0,1]}));
      for(const [j,p] of [points[0],points.at(-1)].entries()) {
        parts.push(frontCylinder(`pipe-end-coupler-${i}-${j}`,p[0],p[1],p[2]-.023,.060,.046,C.silver));
        parts.push(frontLens(`pipe-end-inset-${i}-${j}`,p[0],p[1],p[2]+.022,.036,.011,C.lime));
      }
    }
  }
  if(ov) {
    parts.push(prism('shallow-diamond-support',[[-.90,0],[0,-.70],[.90,0],[0,.70]],.045,.135,C.green,{bevel:.025}));
    parts.push(prism('black-faceted-diamond-frame',[[-.84,0],[0,-.645],[.84,0],[0,.645]],.12,.18,C.black,{bevel:.035}));
    parts.push(ring('small-black-core-collar',r+.085,r-.04,.17,.255,C.dark));
    const lids=[{id:'left',poly:[[-.86,0],[0,-.64],[0,.64]]},{id:'right',poly:[[.86,0],[0,.64],[0,-.64]]}];
    for(const lid of lids) {
      parts.push(prism(`green-lid-rim-${lid.id}`,lid.poly,.322,.355,C.green,{group:`lid-${lid.id}`,bevel:.018}));
      const poly=lid.poly.map(([x,z])=>[x*.93,z*.91]);
      parts.push(prism(`black-lid-panel-${lid.id}`,poly,.351,.38,C.black,{group:`lid-${lid.id}`,bevel:.018}));
    }
    for(let i=0;i<3;i++) parts.push(box(`three-front-green-markers-${i}`,[-.17+i*.17,-.15,.758],[.09,.09,.028],C.green,{bevel:.006}));
  }
  const coreCenter=[cx,0,0];
  // The shaft is retained inside the socket when closed and overlaps its fixed collar even at full lift.
  // Its -0.11 lower end stays above the cuff's inner roof, avoiding a piston through the wrist cavity.
  parts.push(cylinder('independent-lift-core',r+.025,-.11,top-.045,C.dark,{center:coreCenter,group:'core'}));
  parts.push(ring('core-lower-seal',r+.04,r-.025,.09,.13,C.black,{center:coreCenter,group:'core'}));
  if(af||ov) coreMarks(parts,cx,r+.027,.14,top-.07);
  parts.push(ring('core-face-beveled-rim',r+.055,r-.048,top-.075,top+.015,ua||watch==='original'?C.silver:C.edge,{center:coreCenter,group:'core'}));
  // Three nested machined layers give the rim a readable lip, inset gasket and lower joint.
  // All remain below or outside the face anchor; they do not cover its selectable symbol.
  parts.push(ring('core-rim-polished-lip',r+.047,r-.043,top+.009,top+.019,C.silver,{center:coreCenter,group:'core',segments:48}));
  parts.push(ring('core-face-inner-gasket',r-.043,r-.055,top+.003,top+.011,C.seam,{center:coreCenter,group:'core',segments:48}));
  parts.push(ring('core-rim-lower-joint',r+.056,r+.041,top-.064,top-.053,C.seam,{center:coreCenter,group:'core',segments:48}));
  parts.push(cylinder('inset-face-glass',r-.043,top-.022,top+.006,C.glass,{center:coreCenter,group:'core'}));
  faceSymbol(parts,cx,top+.008,r-.075,C.lime);
  if(watch==='original') for(let i=0;i<4;i++) {
    const t=Math.PI/4+i*Math.PI/2,center=[cx+Math.cos(t)*(r+.025),0,Math.sin(t)*(r+.025)];
    parts.push(ring(`four-status-light-bezel-${i}`,.068,.047,top+.007,top+.030,C.edge,{center,group:'core',segments:32}));
    parts.push(lens(`four-status-light-green-${i}`,.046,top+.023,top+.048,C.lime,{center,group:'core'}));
  }
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of parts) {
    for(let i=0;i<p.positions.length;i++) {min[i%3]=Math.min(min[i%3],p.positions[i]);max[i%3]=Math.max(max[i%3],p.positions[i]);}
    p.positions=new Float32Array(p.positions);p.normals=new Float32Array(p.normals);p.colors=new Float32Array(p.colors);
  }
  return {watch,parts,face:{center:[cx,top+.021,0],radius:r-.052},lift,bounds:{min,max}};
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
  const angle=Math.abs(bb)<1e-10?(aa>=dd?0:Math.PI/2):Math.atan2(2*bb,aa-dd)/2;
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
  float cavity=0.82+0.18*smoothstep(-1.35,0.02,vWorld.y);
  float diffuse=0.20+0.13*(n.y*0.5+0.5)+0.67*ndk+0.16*ndf;
  vec3 reflected=reflect(-v,n);
  float broadPanel=smoothstep(0.35,0.97,dot(reflected,normalize(vec3(-0.55,0.85,0.35))));
  float edgePanel=smoothstep(0.80,0.98,dot(reflected,normalize(vec3(0.72,0.32,0.65))));
  float exponent=mix(32.0,96.0,max(glass,lamp));
  float highlight=pow(max(dot(n,normalize(key+v)),0.0),exponent);
  float specular=0.075+0.16*metal+0.36*glass+0.20*lamp-0.06*rubber;
  float reflection=(0.045+0.45*metal+0.18*glass)*(1.0-rubber);
  vec3 tint=mix(vec3(0.84,0.92,1.0),base*0.45+vec3(0.55),metal);
  vec3 rgb=base*diffuse*cavity*(1.0-0.17*metal);
  rgb+=tint*(highlight*specular+(broadPanel*0.32+edgePanel*0.23)*reflection);
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
