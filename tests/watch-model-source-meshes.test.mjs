import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto, createHash } from 'node:crypto';
import { createWatchMeshLoader } from '../watch-meshes.js';
import { watchPose, projectWatchFace } from '../watch-model.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const rawRegistry = await readFile(new URL('../assets/watch-meshes/registry.json', import.meta.url));
const registry = JSON.parse(rawRegistry);
const receipt = JSON.parse(await readFile(new URL('../assets/watch-meshes/conversion-receipt.json',import.meta.url),'utf8'));
const load = createWatchMeshLoader({
  manifests: registry.watches, baseUrl: new URL('../preview.html', import.meta.url).href, cryptoImpl: webcrypto,
  fetchImpl: async url => { const bytes = await readFile(new URL(url)); return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; },
});
const sources = new Map();
const proofFor = (watch,id) => receipt.sourceEquivalence.parts.find(p=>p.watch===watch && p.part===id);

test('original supplied source assets load by actual hash, material, bounds and per-generation budget', async () => {
  assert.equal(registry.schemaVersion, 1); assert.deepEqual(Object.keys(registry.watches).sort(), ['omniverse', 'original', 'recalibrated', 'ultimatrix']);
  for (const [watch, manifest] of Object.entries(registry.watches)) {
    const geometry = await load(watch); sources.set(watch, geometry);
    assert.equal(geometry.modelKind, 'source-mesh'); assert.equal(geometry.sourceArchiveSha256, manifest.sourceArchiveSha256);
    assert.equal(geometry.sourceFinish,'source-preserved');
    assert.deepEqual(geometry.sourceMotion,manifest.sourceMotion);
    const triangles = geometry.parts.reduce((count, part) => count + part.positions.length / 9, 0);
    assert.equal(triangles, manifest.triangles, `${watch}: every displayed source part loads`);
    assert.ok(triangles <= 150000, `${watch}: mobile triangle limit`);
    assert.equal(geometry.parts.length, manifest.parts.length);
    assert.equal(load.peek(watch), geometry, `${watch}: parsed geometry is cached`);
  }
});

test('source parts carry coherent actual-face materials, finite unit normals and nonzero triangles', async () => {
  for (const [watch,manifest] of Object.entries(registry.watches)) {
    const geometry = sources.get(watch) || await load(watch);
    for (const part of geometry.parts) {
      const declared=manifest.parts.find(p=>p.id===part.id);
      for (let i=0;i<part.positions.length;i+=9) {
        const p=Array.from(part.positions.slice(i,i+9)),u=p.slice(3,6).map((x,j)=>x-p[j]),v=p.slice(6,9).map((x,j)=>x-p[j]);
        const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        const area2=Math.hypot(...cross);assert.ok(Number.isFinite(area2)&&area2>0,`${watch}/${part.id}: zero-area source face omitted`);
        for(let j=0;j<3;j++) {
          const n=Array.from(part.normals.slice(i+j*3,i+j*3+3));
          assert.ok(n.every(Number.isFinite)&&Math.abs(Math.hypot(...n)-1)<.003);
          assert.ok(n.reduce((sum,x,k)=>sum+x*cross[k],0)/area2>-.03,'normal follows actual source winding');
        }
      }
      for(let i=0;i<part.colors.length;i+=12)for(let c=0;c<4;c++) {
        assert.equal(part.colors[i+c],part.colors[i+4+c]);assert.equal(part.colors[i+c],part.colors[i+8+c],'categorical material does not interpolate across one triangle');
        if(c===3)assert.ok(Number.isInteger(part.colors[i+c])&&part.colors[i+c]>=0&&part.colors[i+c]<=4);
      }
    }
  }
});

test('unchanged source topology is measured and disclosed instead of asserted watertight', async () => {
  for(const watch of Object.keys(registry.watches)) {
    const geometry=sources.get(watch)||await load(watch);
    for(const part of geometry.parts) {
      const vertices=new Map(),edges=new Map(),triangles=new Map();let next=0;
      const idAt=i=>{const key=Array.from(part.positions.slice(i,i+3)).join(',');if(!vertices.has(key))vertices.set(key,next++);return vertices.get(key);};
      for(let i=0;i<part.positions.length;i+=9) {
        const ids=[idAt(i),idAt(i+3),idAt(i+6)];const tk=[...ids].sort((a,b)=>a-b).join(':');triangles.set(tk,(triangles.get(tk)||0)+1);
        for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;const e=edges.get(key)||{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(key,e);}
      }
      const recorded=receipt.parts.find(p=>p.watch===watch&&p.id===part.id).knownSourceTopology,all=[...edges.values()];
      assert.equal(vertices.size,recorded.exactUniquePositions);
      assert.equal(all.filter(e=>e.count===1).length,recorded.boundaryEdges);
      assert.equal(all.filter(e=>e.count>2).length,recorded.nonmanifoldEdges);
      assert.equal(all.filter(e=>e.count===2&&e.direction!==0).length,recorded.windingConflictSharedEdges);
      assert.equal([...triangles.values()].filter(c=>c>1).length,recorded.duplicateTriangleGroups);
    }
  }
});

test('source-equivalence proof binds the delivered byte hashes, coordinate fingerprints and permitted transformations', async () => {
  assert.equal(receipt.status,'source-derived-and-preserved');assert.equal(receipt.registrySha256,hash(rawRegistry));
  assert.equal(receipt.sourceEquivalence.geometryContractPassed,true);assert.equal(receipt.sourceEquivalence.registrySha256,hash(rawRegistry));
  assert.match(receipt.sourceEquivalenceSummarySha256,/^[a-f0-9]{64}$/);
  let omitted=0;
  for(const [watch,manifest]of Object.entries(registry.watches))for(const part of manifest.parts) {
    const r=receipt.parts.find(p=>p.watch===watch&&p.id===part.id),proof=proofFor(watch,part.id);assert.ok(r&&proof);
    assert.equal(r.sha256,part.sha256);assert.equal(r.triangles,part.vertices/3);assert.equal(proof.runtimeSha256,part.sha256);
    assert.equal(proof.authoredGeometry,false);assert.equal(proof.uniformProperRigidTransform,true);
    assert.equal(r.sourcePreservation.authoredGeometry,false);assert.equal(r.sourcePreservation.remeshed,false);
    assert.match(r.sourceCoordinateFingerprint.sha256,/^[a-f0-9]{64}$/);
    if(watch==='original') {
      assert.equal(r.geometryMethod,'source-derived-display-lod');assert.equal(r.sourcePreservation.simplified,true);
      assert.equal(proof.orderedTransformedLodExactlyEqualsActualFloat32,true);
      assert.equal(r.lod.repeatedQemBytesIdentical,true);assert.equal(r.triangles,r.lod.lodTriangles-r.removedZeroAreaAfterFloat32Count);
      assert.ok(r.lod.maximumAbsoluteBboxExtremeDelta<.02,'QEM maintains exact all-vertex source bounds within .02 source mm');
      for(const direction of ['sourceToLod','lodToSource']) {
        assert.equal(r.lod[direction].samples,20000);assert.equal(r.lod[direction].globalHausdorffBound,false);
        assert.ok(r.lod[direction].maximumObservedSample<.1,'sampled error remains below .1 source mm, not a global Hausdorff bound');
      }
      assert.equal(r.derivedPlacement.sourcePrinterAssemblyUsed,false);
    } else {
      assert.equal(proof.orderedTransformedSourceTrianglesExactlyEqualDeliveredFloat32,true);
      assert.equal(proof.allRemovedFacesExactlyZeroAreaAfterFloat32,true);assert.equal(proof.sourceAndFaceSelectionAndTransformExactlyMatchIndependentProof,true);
      for(const key of ['simplified','verticesMovedBeyondTransformAndFloat32','sourceFacesReordered'])assert.equal(r.sourcePreservation[key],false);
      assert.equal(r.retainedSourceTriangleCount+r.removedZeroAreaAfterFloat32Count,r.selectedSourceTriangleCount);
      assert.equal(r.removedDuplicateCount,0);omitted+=r.removedZeroAreaAfterFloat32Count;
      assert.match(r.retainedSourceFaceIndicesSha256,/^[a-f0-9]{64}$/);
    }
    const bytes=await readFile(new URL('../'+part.file.replace(/^\.\//,''),import.meta.url));
    assert.equal(hash(bytes),part.sha256);const xyz=Buffer.alloc(part.vertices*12);
    for(let i=0;i<part.vertices;i++)bytes.copy(xyz,i*12,i*40,i*40+12);
    assert.equal(hash(xyz),r.runtimeCoordinatesSha256);
    const m=r.matrixRowMajor4x4,s=r.uniformScale;assert.equal(m.length,4);assert.deepEqual(m[3],[0,0,0,1]);
    for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs([0,1,2].reduce((sum,k)=>sum+m[k][a]*m[k][b],0)-(a===b?s*s:0))<1e-12);
    assert.ok(r.source.archiveEntry&&!r.source.archiveEntry.startsWith('/')&&!r.source.archiveEntry.includes('..'));
    assert.ok(!JSON.stringify(r.source).includes('.local/'),'source provenance names archive members, not local paths');
  }
  assert.equal(omitted,16,'exact-source three watches retain all nonzero source faces');
  assert.equal(registry.watches.original.triangles,120000);
  assert.deepEqual(receipt.parts.filter(p=>p.watch==='original').map(p=>p.sourceTriangleCount).sort((a,b)=>a-b),[47104,300894,389120,578444]);
  assert.equal(receipt.lodSimplification.targetTriangles,120000);
  assert.equal(receipt.parts.length,14);assert.equal(receipt.parts.reduce((n,p)=>n+p.triangles,0),165994);
});

test('face overlays stay anchored to an actual supplied display surface without generated black caps',async()=>{
  for(const watch of Object.keys(registry.watches)) {
    const geometry=sources.get(watch)||await load(watch),[cx,y,cz]=geometry.face.center;
    let highest=-Infinity;
    const candidates=geometry.sourceMotion.core?geometry.parts.filter(p=>p.group==='core'):geometry.parts;
    for(const p of candidates)for(let i=0;i<p.positions.length;i+=3)if(Math.hypot(p.positions[i]-cx,p.positions[i+2]-cz)<geometry.face.radius*.9)highest=Math.max(highest,p.positions[i+1]);
    assert.ok(Number.isFinite(highest)&&Math.abs(y-highest)<.001,`${watch}: overlay tracks source native display surface`);
  }
});

test('no additional watch geometry or unsupported split-lid rig is reintroduced', async () => {
  for(const [watch,manifest]of Object.entries(registry.watches)) {
    assert.equal(manifest.sourceFinish,'source-preserved');assert.equal(manifest.sourceMotion.lids,false);
    assert.ok(manifest.parts.every(p=>p.id.startsWith('source-')&&!p.id.includes('authored')&&!p.id.includes('derived')));
    assert.ok(manifest.parts.every(p=>['body','core'].includes(p.group)));
    const geometry=sources.get(watch)||await load(watch);
    if(!manifest.sourceMotion.core) {
      assert.equal(manifest.lift,0);assert.ok(manifest.parts.every(p=>p.group==='body'));
      assert.equal(watchPose({watch,mode:'projection',raised:1},geometry).lift,0);
    }
    assert.equal(watchPose({watch,mode:'projection',raised:1},geometry).lidSlide,0);
  }
  assert.deepEqual(registry.watches.original.parts.map(p=>p.id),['source-reboot-cuff','source-reboot-dial','source-reboot-core','source-reboot-button']);
  assert.equal(registry.watches.original.sourceArchiveName,'Omnitrix+ben+10+reboot+season+1.zip');
  assert.equal(registry.watches.recalibrated.parts.length,1);assert.equal(registry.watches.ultimatrix.parts.length,2);assert.equal(registry.watches.omniverse.parts.length,7);
  assert.ok(registry.watches.omniverse.parts.some(p=>p.id==='source-ov-single-cover'));
  assert.equal(receipt.excludedSourceParts.length,2);
  assert.deepEqual(receipt.excludedSourceParts.map(p=>p.triangles).sort((a,b)=>a-b),[32,84]);
  for(const p of receipt.excludedSourceParts){assert.equal(p.status,'retained-in-source-library-not-assembled');assert.equal(p.watch,'omniverse');}
});

test('every source-mesh vertex and projected dial fits every production camera and lift checkpoint', async () => {
  for (const watch of Object.keys(registry.watches)) {
    const geometry = sources.get(watch) || await load(watch);
    for (const mode of ['projection', 'carousel', 'dial']) for (const view of ['top', 'left', 'low', 'right']) for (const raised of [0, .25, .5, .75, 1]) {
      const pose = watchPose({ watch, mode, view, raised }, geometry);
      const ca = Math.cos(pose.azimuth), sa = Math.sin(pose.azimuth), ce = Math.cos(pose.elevation), se = Math.sin(pose.elevation), lens = Math.tan(pose.fov / 2);
      const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, near: Infinity, far: -Infinity };
      for (const part of geometry.parts) for (let i = 0; i < part.positions.length; i += 3) {
        const slide = part.group === 'lid-left' ? -pose.lidSlide : part.group === 'lid-right' ? pose.lidSlide : 0;
        const x = part.positions[i] + slide - pose.target[0], y = part.positions[i + 1] + (part.group === 'core' ? pose.lift : 0) - pose.target[1], z = part.positions[i + 2] - pose.target[2];
        const horizontal = x * ca - z * sa, rotatedZ = x * sa + z * ca, vertical = y * ce - rotatedZ * se, depth = pose.distance - y * se - rotatedZ * ce;
        const px = .5 + horizontal / (2 * depth * lens), py = .5 - vertical / (2 * depth * lens);
        bounds.minX = Math.min(bounds.minX, px); bounds.maxX = Math.max(bounds.maxX, px); bounds.minY = Math.min(bounds.minY, py); bounds.maxY = Math.max(bounds.maxY, py); bounds.near = Math.min(bounds.near, depth); bounds.far = Math.max(bounds.far, depth);
      }
      const label = `${watch}/${mode}/${view}/${raised}: ${JSON.stringify(bounds)}`;
      assert.ok(Object.values(bounds).every(Number.isFinite), label);
      assert.ok(bounds.minX >= 0 && bounds.maxX <= 1 && bounds.minY >= 0 && bounds.maxY <= 1 && bounds.near > .1 && bounds.far < 25, label);
      const face = projectWatchFace(geometry, pose, 1), angle = face.a * Math.PI / 180;
      const extentX = Math.hypot(face.w / 2 * Math.cos(angle), face.h / 2 * Math.sin(angle));
      const extentY = Math.hypot(face.w / 2 * Math.sin(angle), face.h / 2 * Math.cos(angle));
      assert.equal(face.visible, true, `${label}: visible face`);
      assert.ok(face.x - extentX >= 0 && face.x + extentX <= 1 && face.y - extentY >= 0 && face.y + extentY <= 1, `${label}: projected overlay remains in the canvas`);
      if (mode === 'dial') { assert.equal(pose.lift, 0); assert.equal(face.a, 0); }
    }
  }
});
