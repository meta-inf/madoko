/*---------------------------------------------------------------------------
  Copyright 2013 Microsoft Corporation.
 
  This is free software; you can redistribute it and/or modify it under the
  terms of the Apache License, Version 2.0. A copy of the License can be
  found in the file "license.txt" at the root of this distribution.
---------------------------------------------------------------------------*/


function dispatchEvent( elem, eventName ) {
  var event;  
  if (document.createEvent) {
      event = document.createEvent('Event');
      event.initEvent(eventName,true,true);
  }
  else if (document.createEventObject) { // IE < 9
      event = document.createEventObject();
      event.eventType = eventName;
  }
  event.eventName = eventName;
  if (elem.dispatchEvent) {
      elem.dispatchEvent(event);
  }
  else if (elem.fireEvent) { 
      elem.fireEvent('on' + eventName, event);
  }
  else if (elem[eventName]) {
      elem[eventName]();
  } 
  else if (elem['on' + eventName]) {
      elem['on' + eventName]();
  }
}


(function() {

  // initialize
  var origin = window.location.origin || window.location.protocol + "//" + window.location.host;

  // Refresh message after 5 secs
  setTimeout(function() {
    var p = document.getElementById("preview-refresh");
    if (p) {
      p.className = p.className.replace(/\bpreview-hidden\b/g,"");
    }
  }, 5000);

  
  /*-------------------------------------------------------
     On double click, navigate to correct line
  -------------------------------------------------------*/  
  function findLocation( root, elem ) {
    while (elem && elem !== root) {
      var dataline = (elem.getAttribute ? elem.getAttribute("data-line") : null);
      if (dataline) {
        cap = /(?:^|;)(?:([^:;]+):)?(\d+)$/.exec(dataline);
        if (cap) {
          var line = parseInt(cap[2]);
          if (line && line !== NaN) {
            return { path: cap[1], line: line };
          } 
        }
      }
      // search through previous siblings too since we include line span info inside inline element sequences.
      elem = (elem.previousSibling ? elem.previousSibling : elem.parentNode);
    }
    return null;
  }

  document.body.ondblclick = function(ev) {
    if (typeof(Reveal) !== "undefined" && /\bnavigate-/.test(ev.target.className) && /\bcontrols\b/.test(ev.target.parentNode.className)) return; // don't count double clicks on controls in presentations
    var res = findLocation(document.body,ev.target);
    if (res) {
      res.eventType = 'previewSyncEditor';
      window.parent.postMessage( JSON.stringify(res), origin);
      console.log('posted: ' + JSON.stringify(res));
    }
  };


  /*-------------------------------------------------------
     Scroll to right location based on a line number
  -------------------------------------------------------*/  
  function px(s) {
    if (typeof s === "number") return s;
    var cap = /^(\d+(?:\.\d+)?)(em|ex|pt|px|pc|in|mm|cm)?$/.exec(s);
    if (!cap) return 0;
    var i = parseInt(cap[1]);
    if (isNaN(i)) return 0;
    if (cap[2] && cap[2] !== "px") {
      var dpi = 96;
      var empx = 12;
      if (cap[2]==="em") {
        i = (i * empx);
      }
      else if (cap[2]==="ex") {
        i = (i * empx * 0.5);
      }
      else if (cap[2]==="pt") {
        i = (i/72) * dpi;
      }
      else if (cap[2]==="pc") {
        i = (i/6) * dpi;
      }
      else if (cap[2]==="in") {
        i = i * dpi;
      }
      else if (cap[2]==="mm") {
        i = (i/25.6) * dpi;
      }
      else if (cap[2]==="cm") {
        i = (i/2.56) * dpi;
      }
    }
    return i;
  }

  function elemOffsetTop(elem,forward) {
    // we search backward or forward to the first node that has a valid offsetTop (ie. non-empty element)
    while (elem.nodeType !== 1 || elem.clientHeight === 0) {
      var next = (forward ? elem.nextSibling : elem.previousSibling);
      if (!next) next = elem.parentNode;
      if (!next) break;
      elem = next;
    }
    return elem.offsetTop;
  }

  function bodyOffsetTop(elem,forward) {
    // somehow the offset top calculation is wrong for code elements directly in a pre element, so we adjust here.
    if (elem.nodeName==="CODE" && elem.parentNode && elem.parentNode.nodeName==="PRE") {
      elem = elem.parentNode;
    }
    var offset = 0;
    while( elem && elem.nodeName != "BODY") {
      offset += elemOffsetTop(elem,forward);
      elem = elem.offsetParent;
    }
    return offset;
  }

  function offsetOuterTop(elem,forward) {
    var delta = 0;
    if (elem.nodeType === 1 && window.getComputedStyle) {
      var style = window.getComputedStyle(elem);
      if (style) {
        delta = px(style.marginTop) + px(style.paddingTop) + px(style.borderTopWidth);
      }   
    }
    return (bodyOffsetTop(elem,forward) - delta);
  }

  function getScrollTop( elem ) {
    if (!elem) return 0;
    if (elem.contentWindow) {
      // iframe
      if (elem.contentWindow.pageYOffset) return elem.contentWindow.pageYOffset;
      var doc = elem.contentDocument;
      if (!doc) return 0;
      return (doc.documentElement || doc.body.parentNode || doc.body).scrollTop;
    }
    else if (typeof elem.pageYOffset !== "undefined") {
      return elem.pageYOffset;
    }
    else {
      return elem.scrollTop;
    }
  }

  function setScrollTop( elem, top ) {
    if (!elem) return;
    if (elem.contentWindow) {
      elem = elem.contentWindow;
    }
    if (elem.scroll) {
      elem.scroll( elem.pageXOffset || 0, top );
    }
    else {
      elem.scrollTop = top;
    }
  }

  function animateScrollTop( elem, top, duration, steps ) {
    var top0 = getScrollTop(elem);
    if (top0 === top) return;
    if (duration <= 50 || Math.abs(top - top0) <= 2) {
      duration = 1;
      steps = 1;
    }

    var n = 0;
    var action = function() {
      n++;
      var top1 = top;
      if (n >= steps) {
        if (elem.animate) {
          clearInterval(elem.animate);
          delete elem.animate;
        }
      }
      else {
        top1 = top0 + ((top - top0) * (n/steps));
      }
      //console.log( "  scroll step " + n + " to " + top1 + ", " + top0 + ", " + steps);
      setScrollTop(elem,top1);
    };

    var ival = (steps && steps > 0 ? duration / steps : 50);
    steps = (duration / ival) | 0;
    
    action();    
    if (steps > 1) {
      if (elem.animate) {
        clearInterval(elem.animate);
      }    
      elem.animate = setInterval( action, ival);    
    }
  }


  function findNextElement(root,elem) {
    if (elem == null || elem === root) return elem;
    if (elem.nextSibling) return elem.nextSibling;
    return findNextElement(root,elem.parentNode);
  }

  function nextAdjust(elem) {
    if (elem && elem.nodeName === "SECTION" && elem.firstChild) {
      return elem.firstChild;
    }
    return elem;
  }

  function bodyFindElemAtLine( lineCount, line, fname ) {    
    var selector = "[data-line" + (fname ? '*=";' + fname + ':"' : "") + "]";
    var elems = document.querySelectorAll( selector );
    if (!elems) elems = [];

    var currentLine = line;
    var current = elems[0];
    var nextLine = line;
    var next = null;
    for(var i = 0; i < elems.length; i++) {
      var elem = elems[i];
      var dataline = elem.getAttribute("data-line");
      if (dataline) { // && child.style.display.indexOf("inline") < 0) {
        if (fname) {
          var idx = dataline.indexOf(fname + ":");
          dataline = (idx >= 0 ? dataline.substr(idx + fname.length + 1) : "" /* give NaN to parseInt */ );         
        } 
        var cline = parseInt(dataline);
        if (!isNaN(cline)) {
          if (cline <= line) {
            currentLine = cline;
            current = elems[i];
          }
          if (cline > line) {
            nextLine = cline;
            next = elems[i];
            break;
          }
        }
      }
    }

    if (!current) return null;
    if (!next) {
      next = findNextElement(document.body,current);
      nextLine = lineCount;
    }
    return { elem: current, elemLine : currentLine, next: next, nextLine: nextLine };
  }

  var lastScrollTop = -1;

  function scrollToLine( info )
  {
    var scrollTop = 0;
    if (info.sourceName || info.textLine > 1) {
      var res = bodyFindElemAtLine(info.lineCount, info.textLine, info.sourceName); // findElemAtLine( document.body, info.textLine, info.sourceName );
      if (!res) return false;
      if (typeof(Reveal)!=="undefined") return scrollToSlide(res);

      scrollTop = offsetOuterTop(res.elem); 
      //console.log("find elem at line: " + info.textLine + ":" ); console.log(info); console.log(res);
      
      // adjust for line delta: we only find the starting line of an
      // element, here we adjust for it assuming even distribution up to the next element
      if (res.elemLine < info.textLine && res.elemLine < res.nextLine) {
        var scrollTopNext = offsetOuterTop(res.next,true); 
        if (scrollTopNext > scrollTop) {
          var delta = 0;
          /*
          if (slines) {
            // wrapping enabled, translate to view lines and calculate the offset
            var elemViewLine = slines.convertInputPositionToOutputPosition(res.elemLine,0).lineNumber;
            var nextViewLine = slines.convertInputPositionToOutputPosition(res.nextLine,0).lineNumber;
            delta = (info.viewLine - elemViewLine) / (nextViewLine - elemViewLine + 1);
          } 
          else {
          */
            // no wrapping, directly calculate 
            delta = (info.textLine - res.elemLine) / (res.nextLine - res.elemLine + 1);
          //}
          if (delta < 0) delta = 0;
          if (delta > 1) delta = 1;
          scrollTop += ((scrollTopNext - scrollTop) * delta);
        }
      }

      // we calculated to show the right part at the top of the view,
      // now adjust to actually scroll it to the middle of the view or the relative cursor position.
      var relative = (info.viewLine - info.viewStartLine) / (info.viewEndLine - info.viewStartLine + 1);
      scrollTop = Math.max(0, scrollTop - (info.height != null ? info.height : document.body.clientHeight) * relative ) | 0; // round it
    }

    // exit if we are still at the same scroll position
    if (scrollTop === lastScrollTop && !info.force) return false;
    lastScrollTop = scrollTop;

    // otherwise, start scrolling
    animateScrollTop(window, scrollTop, info.duration != null ? info.duration : 500);
    return true;
  }

  /*-------------------------------------------------------
     Slide navigation
  -------------------------------------------------------*/
  function getSlidesElem() {
    var elems = document.getElementsByClassName("slides");
    return elems[0];
  }

  function getSlideIndices(slide) {
    var slides = getSlidesElem();
    if (!slides) return null;
    var h = 0;
    var section = slides.firstElementChild;
    while(section) {
      if (section.nodeName==="SECTION") {
        if (section===slide) return { h: h, v: 0 };
        if (/\bvertical\b/.test(section.className)) {
          var v = 0;        
          var vsection = section.firstElementChild;
          while(vsection) {
            if (vsection===slide) return {h:h,v:v};
            if (vsection.nodeName==="SECTION") {
              v++;
            }
            vsection = vsection.nextElementSibling;
          }
        }
        h++;
      }
      section = section.nextElementSibling;
    }
    return null;
  }

  function scrollToSlide(info) {
    var elem = info.elem;
    // check for the last line, and redirect to the last slide
    if (elem && elem.previousElementSibling && /\breveal\b/.test(elem.previousElementSibling.className)) {
      elem = elem.previousElementSibling.firstElementChild.lastElementChild;
    }
    while(elem && elem.nodeName !== "SECTION") {
      elem = elem.parentNode;
    }
    if (!elem) return false;
    var pos = getSlideIndices(elem);
    if (!pos) return false;
    Reveal.slide(pos.h,pos.v);
    return true;
  }


  /*-------------------------------------------------------
     Load content
  -------------------------------------------------------*/
  function findTextNode( elem, text ) {
    if (!elem || !text) return null;
    if (elem.nodeType===3) {
      if (elem.textContent === text) return elem;      
    }
    else {
      for( var child = elem.firstChild; child != null; child = child.nextSibling) {
        var res = findTextNode(child,text);
        if (res) return res;
      }
    }
    return null;  
  }

  function revealRefresh( query ) {
    if (typeof(Reveal)==="undefined") return;
    if (!Reveal.config) {
      if (typeof(revealConfig) !== "undefined") 
        Reveal.config = revealConfig;
      else {
        Reveal.config = {  
          controls: true,
          progress: true,
          center: true,
          history: false,
        };
      }
    }

    // parse the query
    if (query) {
      var rx = /(\w+)=([\w\.%\-]*)/g;
      var cap;
      while( cap = rx.exec(query) ) {
        var s = decodeURIComponent(cap[2]);
        Reveal.config[cap[1]] = (s==="null" ? null : (s==="true" ? true : (s === "false" ? false : s))); 
      }
    }

    // remember our position, and initialize special elements
    var pos = (Reveal.isReady() ? Reveal.getIndices() : { h: 0, v: 0, f:undefined });
    if (!query) {
      var items = document.querySelectorAll( ".fragmented>li" );
      for(var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item && !/\bfragment\b/.test(item.className)) item.className = item.className + " fragment";
      }
      items = document.querySelectorAll('a[href^="?"]'); // get all query references
      for(var i = 0; i < items.length; i++) {
        var item = items[i];
        var query = item.getAttribute("href");
        var listen = function(q) { // we pass query to a function to capture it fresh in q for every element
          item.addEventListener("click", function(ev) {
            ev.stopPropagation();
            ev.preventDefault();
            revealRefresh( q );
          });
        };
        listen(query); 
      }
    }
    
    // remove class names on reveal element that otherwise prevent transitions from updating
    var elem = document.querySelectorAll("div.reveal")[0];
    if (elem) elem.className="reveal";

    // re-initialize and restore position
    Reveal.initialize(Reveal.config);
    Reveal.slide(pos.h,pos.v,pos.f);      
  }

  // we only load script tags once in the preview (and never remote them)
  var loadedScripts = {};

  function loadContent(info) {
    if (info.oldText) {
      //console.log("  try quick update:\n old: " + info.oldText + "\n new: " + info.newText);
      var elem = findTextNode( document.body, info.oldText );
      if (elem) {
        // yes!
        console.log("preview: quick view update" );
        elem.textContent = info.newText;        
        return;
      }
    }
    // do a full update otherwise 
    // note: add a final element to help the scrolling to the end.
    var finalElem = (typeof info.lineCount === "number" ? "<div data-line='" + info.lineCount.toFixed(0) + "'></div>" : "");
    document.body.innerHTML = info.content + finalElem;
    // execute inline scripts
    var scripts = document.body.getElementsByTagName("script");   
    for(var i=0;i<scripts.length;i++) {  
      var script = scripts[i];
      var src = script.getAttribute("src");
      if (!src) {
        eval(scripts[i].text);  
      }
      else if (!loadedScripts["/" + src]) {
        loadedScripts["/" + src] = true;
        var xscript = document.createElement("script");      
        var attrs = script.attributes;
        for(var j = 0; j < attrs.length; j++) {
          xscript.setAttribute( attrs[j].name, attrs[j].value );
        }      
        document.documentElement.appendChild(xscript);
      }
    }  
    // append script to detect onload event
    var loaded = document.createElement("script");
    loaded.type = "text/javascript";
    var code = "dispatchEvent(document,'load');";
    loaded.appendChild( document.createTextNode(code));
    document.body.appendChild(loaded);    

    // reveal support
    if (typeof(Reveal) !== "undefined") {
      revealRefresh();
    }
  }

  document.addEventListener("load", function(ev) {
    window.parent.postMessage(JSON.stringify({eventType:'previewContentLoaded'}),origin);
    var refs = document.getElementsByTagName("a");
    for(var i = 0; i < refs.length; i++) {
      var ref = refs[i];
      if (!/\blocalref\b/.test(ref.className) && origin !== ref.protocol + "//" + ref.host && !ref.target) {
        ref.target = "_blank"; // make all non-relative links open in a new window
      }
    }
  });

  /*-------------------------------------------------------
     React to messages
  -------------------------------------------------------*/
  window.addEventListener("message", function(ev) {
    // check origin and source element so no-one else can send us messages
    if (ev.origin !== origin) return;
    if (ev.source !== window.parent) return;

    var info = JSON.parse(ev.data);
    if (!info || !info.eventType) return;
    if (info.eventType==="scrollToLine") {
      //console.log("scroll to line: " + info.textLine.toString() + " in " + info.duration);
      scrollToLine(info);
    }
    else if (info.eventType==="scrollToY") {
      setScrollTop(window,info.scrollY);
    }
    else if (info.eventType==="loadContent") {      
      loadContent(info);
      //ev.source.postMessage('contentLoaded',ev.origin);
    }
  });



  /*
  try {
    var req = new XMLHttpRequest();
    var url = "https://madoko.cloudapp.net/index.html";
    req.open("GET", url, true );
    req.onload = function(res) {
      console.log("PREVIEW WARNING: can access root domain!!");
    };
    req.onerror = function(res) {
      console.log("PREVIEW OK: cannot access root domain");    
    }
    req.send(null);
  }
  catch(exn) {
    console.log("PREVIEW OK: cannot do XHR: " + exn.toString());
  }

  try {
    var ticks = localStorage.getItem( "ticks" );
    console.log("PREVIEW WARNING: can access local storage for root domain!!")
  }
  catch(exn) {
    console.log("PREVIEW OK: cannot access local storage for root domain.")
  }
  
  try {
    var cookie = document.cookie;
    console.log( "PREVIEW WARNING: could accesss cookie for root domain!!");
  }
  catch(exn) {
    console.log("PREVIEW OK: cannot access cookies of root domain.")
  }
  */

  //console.log("previewjs loaded: " + origin);
})();
