const $=require("jquery"),{thenNotify}=require("../render/chrome"),{draggable,byDelta}=require("../util");module.exports=(e,t,o,a)=>{const r=e.find("#vannot-tooltip");if(e.on("mouseenter","[title]",(e=>{const t=$(e.target),o=t.offset(),a=t.outerWidth(),n=t.attr("title");r.removeClass("dropped mirrored"),r.css("left",o.left+a/2),r.css("top",o.top),r.text(n),r.show(),r.height()>20&&(r.addClass("mirrored"),r.css("left",0),r.css("left",o.left+a/2-r.width())),o.top<25&&(r.addClass("dropped"),r.css("top",o.top+t.outerHeight())),t.attr("title",""),t.one("mouseleave click",(()=>{t.attr("title",n),r.hide()}))})),null!=t.app&&(null!=t.app.title&&(document.title=t.app.title),null!=t.app.favicon)){const e=$("<link/>").attr("type","image/x-icon").attr("rel","shortcut icon").attr("href",t.app.favicon);$("head").append(e)}draggable(e.find(".vannot-controls-resizer"),byDelta(((e,t)=>{a.lowerHeight-=t,$(window).trigger("resize")}))),e.find(".vannot-save").on("click",(()=>{t.save().then(thenNotify("Data has been successfully saved!"),thenNotify("Something went wrong trying to save data. Please check your connection and try again.","error"))})),$(window).on("beforeunload",(e=>{if(t.changed())return"It looks like you have made changes since your last save. Are you sure you wish to leave?"}))};