import fs from 'node:fs';import ts from 'typescript';
const transpile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const geometry='data:text/javascript;base64,'+Buffer.from(transpile('packages/routing/src/geometry-safety.ts')).toString('base64');
const code=transpile('packages/routing/src/index.ts').replace("'./geometry-safety'",JSON.stringify(geometry));
const {findRoute}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const graph=JSON.parse(fs.readFileSync('data/buildings/B03/GF.graph.json','utf8'));const floor=JSON.parse(fs.readFileSync('data/buildings/B03/GF.json','utf8'));
for(const n of [1,5,14,28,54]){const r=findRoute(graph,floor.rooms[0].doorNodeId,floor.rooms[n-1].doorNodeId);console.log(n,r.status,r.reason,r.points.length)}
