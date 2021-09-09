const EventEmitter=require("events"),{max}=Math,{without,concat,uniq}=require("ramda"),{spliceOut,last,pointsEqual,withinBox,distance,midpoint}=require("../util");class Canvas{constructor(e,t){this.player=e,this.data=t,this.events=new EventEmitter,this._initialize()}_initialize(){const e=()=>{this.frame=this.player.frame};this.player.events.on("change.frame",e),e(),this._scale=1,this._pan={x:0,y:0},this._tool="select",this._lowerHeight=410,this.implicitPoints=implicitPoints(this)}get frameObj(){return this._frameObj}set frame(e){const t=this.data.frames.find((t=>t.frame===e));if(null!=this._frameObj){if(null==t&&0===this._frameObj.shapes.length)return void(this._frameObj.frame=e);0===this._frameObj.shapes.length&&spliceOut(this._frameObj,this.data.frames)}null==t?(this._frameObj={frame:e,shapes:[]},this.data.frames.push(this._frameObj)):this._frameObj=t,this.events.emit("change.frame"),this.selectedPoints=[]}get selected(){if(null!=this._selected)return this._selected;const e=this._selectedPoints||[];if(this._selected={points:e,wholeShapes:[],partialShapes:[],instance:null,instances:[],instanceless:!1},e.length>0)for(const t of this.frameObj.shapes){let s=0;for(const i of t.points)e.includes(i)&&s++;s===t.points.length?this._selected.wholeShapes.push(t):s>0&&this._selected.partialShapes.push(t)}1===this._selected.wholeShapes.length&&0===this._selected.partialShapes.length&&(this._selected.shape=this._selected.wholeShapes[0]);const t=uniq(this._selected.wholeShapes.map((e=>e.instanceId||null)));if(t.some((e=>null==e))&&(this._selected.instanceless=!0,spliceOut(null,t)),this._selected.instances=t.map((e=>this.data.instances.find((t=>t.id===e)))),1===this._selected.instances.length){const e=this._selected.instances[0];this.shapesInInstance(e.id).length===this._selected.wholeShapes.length&&(this._selected.instance=e)}return this._selected}set selectedPoints(e){this._selected=null,this._selectedPoints=e,this.events.emit("change.selected")}get scale(){return this._scale}set scale(e){this._scale=e,this._projection=null,this.events.emit("change.projection")}get pan(){return this._pan}set pan(e){this._pan=e,this._projection=null,this.events.emit("change.projection")}get viewportSize(){return this._viewportSize}set viewportSize(e){this._viewportSize=e,this._projection=null,this.events.emit("change.projection")}get lowerHeight(){return this._lowerHeight}set lowerHeight(e){this._lowerHeight=max(180,e),this._projection=null,this.events.emit("change.layout"),this.events.emit("change.projection")}get projection(){if(null!=this._projection)return this._projection;const e=this.data.video,t=e.width/e.height,s=this.viewportSize.padding,i=this.viewportSize.width-s,n=this.viewportSize.height-s,h=i/n>t?e.height/n/this.scale:e.width/i/this.scale,a=i/2-e.width/2/h+this.pan.x,l=n/2-e.height/2/h+this.pan.y,o=s/2,c=e=>e/h+o+a,p=e=>e/h+o+l,r=({x:e,y:t})=>({x:c(e),y:p(t)});return r.x=c,r.y=p,this._projection={factor:h,origin:{x:a,y:l},project:r},this._projection}get lasso(){return this._lasso}set lasso(e){this._lasso=e,this.events.emit("change.lasso")}get mouse(){return this._mouse}set mouse(e){this._mouse=e,this.events.emit("change.mouse")}get dragState(){return this._dragState}set dragState(e){this._dragState=e,this.events.emit("change.mouse")}get tool(){return this._toolOverride||this._tool}set tool(e){this._tool=e,this.events.emit("change.tool")}set toolOverride(e){this._toolOverride=e,this.events.emit("change.tool")}changedPoints(){this.events.emit("change.points")}changedShapes(){this.events.emit("change.shapes")}changedInstances(){this._selected=null,this.events.emit("change.instances")}get state(){if(null!=this.wip)return"drawing";if(0===this.selected.points.length&&null==this.wip)return"normal";if(this.selected.wholeShapes.length>0&&0===this.selected.partialShapes.length)return"shapes";if(this.selected.partialShapes.length>0)return"points";throw new Error("unknown state!")}get wip(){return this.frameObj.shapes.find((e=>!0===e.wip))}get wipSegment(){return null==this.wip||0===this.wip.points.length?null:[last(this.wip.points),this.mouse]}get instanceMode(){return null==this.data.app||null==this.data.app.instance||null==this.data.app.instance.classMode?"freeform":this.data.app.instance.classMode}resetViewport(){this.scale=1,this.pan={x:0,y:0}}startShape(){this.frameObj.shapes.push({id:this.data._seqId++,objectId:-1,points:[],wip:!0}),this.deselect()}endShape(){const e=this.wip;e.points.length<3?this.removeShape(e):(delete e.wip,this.selectedPoints=e.points,this.changedShapes())}copyLast(){const e=this.player.prevFrame;if(null==e)return;const t=[],s={};e.shapes.forEach((e=>{const i={id:this.data._seqId++,objectId:e.objectId,points:[]};if(null!=e.instanceId)if(null==s[e.instanceId]){const t=this.data._seqId++;i.instanceId=t,s[e.instanceId]=t;const n=this.instance(e.instanceId),h={id:t};null!=n.class&&(h.class=n.class),this.data.instances.push(h)}else i.instanceId=s[e.instanceId];e.points.forEach((e=>i.points.push({x:e.x,y:e.y}))),t.push(...i.points),this.frameObj.shapes.push(i)})),this.selectedPoints=t,this.changedShapes()}duplicateSelected(e=0){const t=[];for(const s of this.selected.wholeShapes){const i=s.points.map((({x:t,y:s})=>({x:t+e,y:s+e}))),n=Object.assign({},s,{points:i});delete n.instanceId,this.frameObj.shapes.push(n),t.push(n)}this.selectShapes(t),this.changedShapes()}selectShape(e){this.selectedPoints=e.points.slice()}selectShapes(e){this.selectedPoints=e.map((e=>e.points)).reduce(concat)}expandSelection(){const e=[];this.selected.partialShapes.forEach((t=>e.push(...t.points))),this.selected.wholeShapes.forEach((t=>e.push(...t.points))),this.selectedPoints=e}selectInstance(e){const t=[];this.frameObj.shapes.forEach((s=>{s.instanceId===e&&t.push(...s.points)})),this.selectedPoints=t}setLasso(e){if(null==e)this.lasso=null;else if(this.lasso=e,pointsEqual(e[0],e[1]))this.selectedPoints=[];else{const e=[];for(const t of this.frameObj.shapes)for(const s of t.points)withinBox(this.lasso,s)&&e.push(s);this.selectedPoints=e}}deselect(){this.selectedPoints=[]}removeShape(e){const t=e.points;spliceOut(e,this.frameObj.shapes),this.changedShapes(),this.selected.points.length>0&&(this.selectedPoints=without(t,this.selected.points))}removePoints(e){const t=0===this.selected.wholeShapes.length&&1===this.selected.partialShapes.length?this.selected.partialShapes[0]:null;for(const e of this.selected.wholeShapes)spliceOut(e,this.frameObj.shapes);for(const t of this.selected.partialShapes){for(const s of e)t.points.includes(s)&&spliceOut(s,t.points);t.points.length<3&&spliceOut(t,this.frameObj.shapes)}this.changedPoints(),this.changedShapes(),null!=t&&this.frameObj.shapes.includes(t)?this.selectShape(t):this.deselect()}formInstance(e){const t=this.data._seqId++;e.forEach((e=>e.instanceId=t)),this.data.instances.push({id:t}),this.changedInstances()}breakInstance(e){const t=uniq(e.map((e=>e.instanceId))),s=[];for(const e of t)if(null!=e){for(const t of this.frameObj.shapes)t.instanceId===e&&(t.instanceId=null,s.push(...t.points));spliceOut(this.instance(e),this.data.instances)}this.changedInstances(),this.selectedPoints=s}setInstanceClass(e,t){null!=e&&(e.class=t,this.changedInstances())}shapesInInstance(e){return this.frameObj.shapes.filter((t=>t.instanceId===e))}instance(e){return this.data.instances.find((t=>t.id===e))}instanceClass(e){return this.data.instanceClasses.find((t=>t.id===e))}}const implicitPoints=e=>{const t={},s=()=>{if(null==e.selected.shape)return;t.points=[];const s=e.selected.shape.points;let i,n;for(let h=0;h<s.length;h++){const a=s[h],l=s[h+1===s.length?0:h+1];if(distance(a,l)*e.scale<40)continue;const o=midpoint(a,l),c=distance(o,e.mouse)*e.scale;c<10?(t.points.push({coords:o,after:a}),(null==n||c<=n)&&(n=c,i=null)):c<40&&(null==n||c<n)&&(n=c,i={coords:o,after:a})}null!=i&&t.points.push(i)};return e.events.on("change.selected",(()=>{null==e.selected.shape?(t.object=null,t.points=[]):(t.object=e.data.objects.find((t=>t.id===e.selected.shape.objectId)),s())})),e.events.on("change.mouse",s),t};module.exports={Canvas};