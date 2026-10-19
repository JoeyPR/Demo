// New bounded descriptor language, NOT a parser for proprietary Growtopia scripts.
// No eval, Function, network, filesystem, or arbitrary JavaScript.
export function runHook(operations,context,{budget=256,depthLimit=12}={}) {
  let remaining=budget;
  const output={pose:{},hide:[],pieces:[],emit:[]};
  function value(v) {
    return v&&typeof v==="object"&&"read" in v ? context[v.read] : v;
  }
  function run(ops,depth) {
    if(depth>depthLimit) throw Error("Script nesting budget exceeded");
    for(const op of ops??[]) {
      if(--remaining<0) throw Error("Script instruction budget exceeded");
      switch(op.op) {
        case "if":
          run(value(op.left)===value(op.equals)?op.then:op.else,depth+1);break;
        case "pose":
          if(!["backAngle","frontAngle","backFoot","frontFoot","face","disableWalk"].includes(op.key))
            throw Error(`Unsupported pose key ${op.key}`);
          output.pose[op.key]=value(op.value);break;
        case "hide": output.hide.push(op.part);break;
        case "piece": output.pieces.push(structuredClone(op.value));break;
        case "emit": output.emit.push(op.emitter);break;
        default: throw Error(`Unsupported script operation ${op.op}`);
      }
    }
  }
  run(operations,0);return output;
}
