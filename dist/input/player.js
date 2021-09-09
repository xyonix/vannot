const $=require("jquery"),{round,trunc,abs,random,min,max}=Math,tcolor=require("tinycolor2"),{clamp,initiateDrag,draggable,byDelta,normalizeBox,datum,spliceOut,defer,px}=require("../util");module.exports=(e,t,n)=>{const a=e.find(".vannot-viewport video"),o=a[0],r=$(document),s=e.find(".vannot-objects"),i=e.find(".vannot-ticks"),c=()=>{t.timelineWidth=i.width()};$(window).on("resize",c),c();const d={brightness:1,greyscale:0},l=()=>{a.css("filter",`brightness(${d.brightness}) grayscale(${d.greyscale})`)};e.find(".vannot-video-brightness-edit").on("change",(e=>{d.brightness=parseFloat($(e.target).val()),l()})),e.find(".vannot-video-chromatic-edit").on("change",(e=>{d.greyscale=parseFloat($(e.target).val()),l()}));const g=e=>()=>{const n=e();null!=n&&t.seek(n.frame)},m=e=>()=>t.seek(t.frame+e);e.find(".vannot-keyback").on("click",g((()=>t.prevFrame))),e.find(".vannot-leapback").on("click",m(-5)),e.find(".vannot-skipback").on("click",m(-1)),e.find(".vannot-playpause").on("click",(()=>t.playing?o.pause():o.play())),e.find(".vannot-skipforward").on("click",m(1)),e.find(".vannot-leapforward").on("click",m(5)),e.find(".vannot-keyforward").on("click",g((()=>t.nextFrame))),e.on("input",".vannot-track-title-edit",(e=>{const n=$(e.target),a=n.val();n.next().text(a),datum(n.closest(".vannot-track")).title=a,t.changedObjects()}));const v=(e,n)=>{const a=$(e.target);datum(a.closest(".vannot-track")).color=n.toHexString(),a.closest(".vannot-objects").length>0?t.changedObjects():t.changedLabels()};e.on("dragstop.spectrum",".vannot-track-color-edit",v),e.on("change.spectrum",".vannot-track-color-edit",v),e.on("hide.spectrum",".vannot-track-color-edit",v),e.on("click",".vannot-track-remove",(e=>{const n=$(e.target);if(n.hasClass("confirm")){const e=datum(n.closest(".vannot-track"));n.closest(".vannot-objects").length>0?(spliceOut(e,t.data.objects),t.changedObjects()):(spliceOut(e,t.data.labels),t.changedLabels())}else n.addClass("confirm"),defer((()=>{r.one("click",(()=>{n.removeClass("confirm")}))}))})),e.find(".vannot-object-new").on("click",(()=>{t.data.objects.push({id:t.data._seqId++,title:"New object",color:tcolor.fromRatio({h:random(),s:1,v:1}).toHexString()}),t.changedObjects()})),s.on("click",".vannot-track-point",(e=>{const a=$(e.target),o=datum(a),r=datum(a.closest(".vannot-track"));t.seek(o.frame),n.selectShapes(o.shapes.filter((e=>e.objectId===r.id)))}));const u=e.find(".vannot-labels");e.find(".vannot-label-new").on("click",(()=>{t.data.labels.push({id:t.data._seqId++,title:"New label",color:tcolor.fromRatio({h:random(),s:1,v:.8}).toHexString(),segments:[]}),t.changedLabels()})),u.on("mousedown",".vannot-track-selection-delete",(e=>{e.preventDefault()})),u.on("click",".vannot-track-selection-delete",(e=>{t.removeSelection()}));const f=e.find("#vannot-thumbnail"),h=f.find("video")[0];h.src=t.video.source;const p=e=>abs(t.scale(e)-t.scale(t.frame))*t.timelineWidth<4?t.frame:e;u.on("mousedown",".vannot-track-timeline",(e=>{if(e.isDefaultPrevented())return;if(0!==e.button)return;t.selection=null;const n=$(e.target),a=n.closest(".vannot-track"),o=e.pageX-a.find(".vannot-track-header").outerWidth(),r=p(round(t.scale.invert(o/t.timelineWidth))),s=datum(a);let i,c,d;n.is(".vannot-track-segment-handle")?(i=datum(n.closest(".vannot-track-segment")),c=()=>{t.mergeSegments()},n.closest(".vannot-track-segment-implicit").length>0?n.is(".handle-implicit-left")?(s.segments.push({start:t.frame,end:i.end}),i.end=t.frame,d=i.start,t.changedLabels()):(s.segments.push({start:i.start,end:t.frame}),i.start=t.frame,d=i.end,t.changedLabels()):d=n.is(".handle-left")?i.end:i.start):n.is(".vannot-track-segment")?(i=t.selection={target:s,start:r,end:r},c=()=>{if(t.selection.start===t.selection.end){const e=datum(n);t.selection={target:s,start:e.start,end:e.end}}}):(i={start:r,end:r},s.segments.push(i),c=()=>{i.start===i.end?(spliceOut(i,s.segments),t.changedLabels()):t.mergeSegments()});const l=e=>{const n=(e-t.video.start)/t.video.duration*t.timelineWidth,a=e<d?n+f.outerWidth():n;f.css("left",px(a)),h.currentTime=e/t.video.fps};f.css("top",px(a.offset().top-f.outerHeight())),l(r),f.show(),null==d&&(d=r),initiateDrag(e,(e=>{const n=round(e/t.timelineWidth*(t.range[1]-t.range[0])),a=t.video.clamp(p(r+n));i.start=min(d,a),i.end=max(d,a),l(a),t.changedLabels()}),(()=>{f.hide(),c()}))})),e.on("mousedown",".vannot-tracks",(e=>{e.isDefaultPrevented()||(t.selection=null)}));const b=e.find(".vannot-scale");b.on("mousedown",(e=>{$(e.target).is(".vannot-playhead")||t.seek(round(t.scale.invert(e.offsetX/t.timelineWidth)))})),draggable(b,((e,n,a=t.frame)=>{const o=trunc(e/t.timelineWidth*(t.range[1]-t.range[0]));return t.seek(a+o),a}));const k=e=>{const n=1.5*t.video.fps;if(t.range[0]<t.frame-n&&t.frame+n<t.range[1]){const a=t.range[1]-t.range[0];let o=(t.frame-n-t.range[0])/a,r=(t.range[1]-n-t.frame)/a;e<0&&(t.range[0]===t.video.start&&(r=1),t.range[1]===t.video.end&&(o=1));const s=clamp(t.video.start,t.range[0]+round(o*e),t.frame-n),i=clamp(t.frame+n,t.range[1]-round(r*e),t.video.end);t.range=[s,i]}else{const a=2*n,o=clamp(t.video.start,t.range[0]+round(.5*e),t.range[1]-a),r=clamp(o+a,t.range[1]-round(.5*e),t.video.end);t.range=[o,r]}};draggable(e.find(".vannot-ranger-start"),byDelta((e=>k(e/t.timelineWidth*1.5*t.video.duration)))),draggable(e.find(".vannot-ranger-end"),byDelta((e=>k(-e/t.timelineWidth*1.5*t.video.duration)))),draggable(e.find(".vannot-ranger-fill"),byDelta((e=>{let n=round(e/t.timelineWidth*t.video.duration);t.range[1]+n>=t.video.end?n=t.video.end-t.range[1]:t.range[0]+n<=t.video.start&&(n=-t.range[0]+t.video.start),t.range=[t.range[0]+n,t.range[1]+n]})))};