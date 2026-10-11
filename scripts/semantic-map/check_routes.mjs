import fs from 'node:fs';import ts from 'typescript';
const transpile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const geometry='data:text/javascript;base64,'+Buffer.from(transpile('packages/routing/src/geometry-safety.ts')).toString('base64');
const code=transpile('packages/routing/src/index.ts').replace("'./geometry-safety'",JSON.stringify(geometry));
const {findRoute}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const selected={building:'B03',floor:'GF'};
for(let i=2;i<process.argv.length;i+=2){const flag=process.argv[i];if(!['--building','--floor'].includes(flag)||!process.argv[i+1])throw new Error(`Invalid selector: ${flag}`);selected[flag.slice(2)]=process.argv[i+1];}
if(selected.building!=='B03'||!['GF','01'].includes(selected.floor))throw new Error('Unsupported building/floor');
const graph=JSON.parse(fs.readFileSync(`data/buildings/${selected.building}/${selected.floor}.graph.json`,'utf8'));const floor=JSON.parse(fs.readFileSync(`data/buildings/${selected.building}/${selected.floor}.json`,'utf8'));
const start=floor.rooms.find(room=>room.doorNodeId);
if(!start)throw new Error('No supported source approach');
for(const room of floor.rooms){const result=findRoute(graph,start.doorNodeId,room.doorNodeId);console.log(room.code,result.status,result.reason?.en??'drawing-based route',result.points.length);}
