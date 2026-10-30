/* Original PCM recorder. Input is downmixed to mono; output is always silent. */
class LoomRecorder extends AudioWorkletProcessor {
  constructor(){super();this.chunk=new Float32Array(2048);this.used=0;this.active=true;this.port.onmessage=({data})=>{if(data==='finish'){this.flush();this.active=false;this.port.postMessage({done:true});}};}
  flush(){if(this.used){const data=this.chunk.slice(0,this.used);this.port.postMessage({samples:data},[data.buffer]);this.used=0;}}
  process(inputs,outputs){for(const output of outputs)for(const channel of output)channel.fill(0);const input=inputs[0];if(this.active&&input?.length){for(let i=0;i<input[0].length;i++){let sample=0;for(const channel of input)sample+=channel[i]||0;this.chunk[this.used++]=sample/input.length;if(this.used===this.chunk.length)this.flush();}}return true;}
}
registerProcessor('loom-recorder',LoomRecorder);
