const{select,line}=require("d3"),{identity,uniq,merge,prop,flatten}=require("ramda"),{round}=Math,{getTemplate,instantiateElems,last,pointsEqual,digestPoint,normalizeBox,expand,unionAll,queuer,px}=require("../util"),lineCalc=line().x((e=>e.x)).y((e=>e.y)),setProjection=(e,t,s)=>{t.style("transform",`translate(${px(e.pan.x)}, ${px(e.pan.y)}) scale(${e.scale})`)},setLayout=(e,t,s)=>{t.style("bottom",px(e.lowerHeight)),s.style("height",px(e.lowerHeight))},drawShapes=(e,t)=>{const s=null==e.frameObj?[]:e.frameObj.shapes,n=instantiateElems(t.selectAll(".trackingShape").data(s),"g","trackingShape"),a=e.selected;n.classed("wip",(e=>!0===e.wip)),n.classed("selected",(e=>a.wholeShapes.includes(e)));const l=e=>a.wholeShapes.includes(e)?e.id:-1*e.id;n.sort(((e,t)=>l(e)-l(t))),n.each((function(t){const s=e.data.objects.find((e=>e.id===t.objectId)),n=null!=s?s.color:null,l=select(this).selectAll(".shapePath").data([t],prop("id"));instantiateElems(l,"path","shapePath").style("fill",n).style("stroke",n).attr("d",(t=>{const s=lineCalc(t.points.map(e.projection.project));return!0===t.wip?s:s+"z"})),instantiateElems(select(this).selectAll(".shapePoint").data(t.points,digestPoint),"circle","shapePoint").classed("selected",(e=>a.points.includes(e))).attr("r",(e=>a.points.includes(e)?4:2)).style("fill",n).attr("cx",(t=>e.projection.project.x(t.x))).attr("cy",(t=>e.projection.project.y(t.y)))}))},drawImplicitPoints=(e,t)=>{const s=instantiateElems(t.selectAll(".implicitPoint").data(e.implicitPoints.points,(e=>digestPoint(e.coords))),"circle","implicitPoint");null!=e.implicitPoints.object&&s.style("fill",e.implicitPoints.object.color).attr("r",4).attr("cx",(t=>e.projection.project.x(t.coords.x))).attr("cy",(t=>e.projection.project.y(t.coords.y)))},drawInstances=(e,t)=>{const s=e.frameObj.shapes.filter((e=>null!=e.instanceId)).map((e=>e.instanceId)),n=flatten(s.map((t=>{const s=e.shapesInInstance(t),n=s.some((t=>e.selected.wholeShapes.includes(t))),a=unionAll(s.map((e=>expand(e.points,25)))),l=e.instanceClass(e.instance(t).class);return a.map(((e,s)=>({id:`${t}-${s}`,points:e,selected:n,instanceClass:l})))})));_drawInstanceOutlines(e,n,t.select(".instanceBases")),_drawInstanceOutlines(e,n,t.select(".instanceDashes"),!0)},_drawInstanceOutlines=(e,t,s,n=!1)=>{const a=s.selectAll(".instanceOutline").data(t,prop("id")),l=instantiateElems(a,"path","instanceOutline");l.classed("selected",prop("selected")).attr("d",(t=>lineCalc(t.points.map(e.projection.project))+"z")),!0===n&&l.style("stroke",(e=>null==e.instanceClass||null==e.instanceClass.color?"#aaa":e.instanceClass.color))},drawWipSegment=(e,t,s)=>{t.attr("cx",e.projection.project.x(e.mouse.x)).attr("cy",e.projection.project.y(e.mouse.y));const n=last(e.wip.points);null==n?s.attr("d",null):s.attr("d",lineCalc([n,e.mouse].map(e.projection.project)))},drawWipCloser=(e,t)=>{null==e.wip||0===e.wip.points.length?t.classed("visible",!1):(t.classed("visible",!0),t.attr("cx",e.projection.project.x(e.wip.points[0].x)).attr("cy",e.projection.project.y(e.wip.points[0].y)))},drawLasso=(e,t)=>{const s=null!=e.lasso&&!pointsEqual(e.lasso[0],e.lasso[1]);if(t.classed("active",s),s){const s=normalizeBox(e.lasso),n=e.projection.project(s[0]),a=e.projection.project(s[1]);t.attr("x",n.x).attr("y",n.y).attr("width",a.x-n.x).attr("height",a.y-n.y)}},drawBounding=(e,t)=>{const s=e.projection.project({x:0,y:0}),n=e.projection.project({x:e.data.video.width,y:e.data.video.height});t.attr("x",s.x).attr("y",s.y).attr("width",n.x-s.x).attr("height",n.y-s.y)},updateCanvasChrome=(e,t,s)=>{s.classed("normal","normal"===t),s.classed("drawing","drawing"===t),s.classed("shapes","shapes"===t),s.classed("points","points"==t),s.classed("tool-select","select"===e.tool),s.classed("tool-pan","pan"===e.tool)},updateObjectSelect=(e,t)=>{if(e.selected.partialShapes.length>0)return;if(0===e.selected.wholeShapes.length)return;const s=e.data.objects.slice(),n=e.selected.wholeShapes.every((t=>t.objectId===e.selected.wholeShapes[0].objectId));!1===n&&s.unshift({id:"multiple",title:"(multiple objects)"}),instantiateElems(t.selectAll("option").data(s),"option").attr("value",prop("id")).text((e=>e.title)),t.node().value=!0===n?e.selected.wholeShapes[0].objectId:"multiple"},updateToolbarCounts=(e,t)=>{if("shapes"===e.state)t.select(".vannot-toolbar-shapes-count").text(e.selected.wholeShapes.length),t.select(".vannot-toolbar-shapes-plural").classed("visible",e.selected.wholeShapes.length>1);else if("points"===e.state){t.select(".vannot-toolbar-points-count").text(e.selected.points.length),t.select(".vannot-toolbar-points-plural").classed("visible",e.selected.points.length>1);const s=e.selected.wholeShapes.length+e.selected.partialShapes.length;t.select(".vannot-toolbar-partial-count").text(s),t.selectAll(".vannot-toolbar-partial-plural").classed("visible",s>1)}},updateInstanceToolbar=(e,t)=>{if("shapes"!==e.state)return;if(t.classed(`vannot-instance-mode-${e.instanceMode}`,!0),t.selectAll(".vannot-toolbar-instance-status").classed("visible",!1),0===e.selected.instances.length)t.select(".vannot-toolbar-instance-none").classed("visible",!0);else if(1===e.selected.instances.length)if(null!=e.selected.instance&&"none"!==e.instanceMode){t.select(".vannot-toolbar-instance-class").classed("visible",!0);for(const s of t.selectAll(".vannot-instance-class").nodes())s.value=e.selected.instance.class||""}else t.select(".vannot-toolbar-instance-assigned").classed("visible",!0),t.select(".vannot-toolbar-instance-count").text(e.shapesInInstance(e.selected.instances[0].id).length);else t.select(".vannot-toolbar-instance-mixed").classed("visible",!0);const s=1===e.selected.instances.length&&!e.selected.instanceless;t.select(".vannot-instance-form").classed("visible",null==e.selected.instance),t.select(".vannot-instance-break").classed("visible",s),t.select(".vannot-instance-select").classed("visible",s&&e.shapesInInstance(e.selected.instances[0].id).length!==e.selected.wholeShapes.length)},updateInstanceList=(e,t)=>{const s=e.data.instances.map((e=>e.class)),n=e.data.instanceClasses.map((e=>e.id)),a=uniq(s.concat(n)).filter((e=>null!=e));instantiateElems(t.selectAll("option").data(a),"option").attr("value",identity).sort()},updateInstanceSelect=(e,t)=>{const s=e.data.instanceClasses.map((e=>({id:e.id,label:e.id})));s.unshift({id:"",label:"(unassigned)"}),instantiateElems(t.selectAll("option").data(s),"option").attr("value",(e=>e.id)).text((e=>e.label))},zoomStops=[.5,.75,1,1.5,2,3,4],updateZoomSelect=(e,t)=>{const s=zoomStops.includes(e.scale)?zoomStops:zoomStops.concat([e.scale]).sort();instantiateElems(t.selectAll("option").data(s),"option").attr("value",identity).text((e=>round(100*e)+"%")),t.node().value=e.scale},updateDragState=(e,t)=>{const s=t.attr("class").split(/ +/g),n=null==e.dragState?"":` dragstate-${e.dragState}`;t.attr("class",s.filter((e=>!e.startsWith("dragstate"))).join(" ")+n)},drawer=(e,t,s)=>{const n=e.select(".vannot-viewport"),a=e.select(".vannot-lower"),l=e.select(".vannot-video"),o=e.select("svg"),c=o.select(".shapes"),i=o.select(".implicitPoints"),r=o.select(".selectionBox"),p=o.select(".boundingBox"),d=o.select(".wipPath"),u=o.select(".wipPoint"),h=o.select(".wipCloser"),m=e.select(".vannot-toolbar"),v=m.select(".vannot-object-select"),g=m.select("#vannot-instance-list"),j=m.select("select.vannot-instance-class"),b=e.select(".vannot-video-zoom-edit"),w=()=>{const t=w.dirty;w.dirty={};const x=s.state;t.projection&&(setProjection(s,l),updateZoomSelect(s,b),drawBounding(s,p)),t.layout&&setLayout(s,n,a),(t.tool||t.selected)&&updateCanvasChrome(s,x,e),t.selected&&updateToolbarCounts(s,m),(t.selected||t.instances)&&updateInstanceToolbar(s,m),t.instances&&("freeform"===s.instanceMode?updateInstanceList(s,g):"preset"===s.instanceMode&&updateInstanceSelect(s,j)),(t.frame||t.projection||t.selected||t.objects||t.shapes||t.points)&&drawShapes(s,c),(t.frame||t.projection||t.selected||t.points||t.instances)&&drawInstances(s,o),(t.selected||t.objects||t.shapes)&&updateObjectSelect(s,v),t.lasso&&drawLasso(s,r),"drawing"===x&&(drawWipSegment(s,u,d),drawWipCloser(s,h)),(t.selected||null!=s.selected.shape&&t.mouse)&&drawImplicitPoints(s,i),t.mouse&&updateDragState(s,e)};return w.dirty={},w},reactor=(e,t,s)=>{const n=drawer(e,0,s),a=queuer(n),l=e=>()=>{a(),n.dirty[e]=!0};s.events.on("change.frame",l("frame")),s.events.on("change.selected",l("selected")),s.events.on("change.lasso",l("lasso")),s.events.on("change.layout",l("layout")),s.events.on("change.projection",l("projection")),s.events.on("change.mouse",l("mouse")),s.events.on("change.points",l("points")),s.events.on("change.shapes",l("shapes")),s.events.on("change.instances",l("instances")),s.events.on("change.tool",l("tool")),t.events.on("change.objects",l("objects")),l("frame")(),l("projection")(),l("instances")()};module.exports={reactor};