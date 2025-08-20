"use strict";
var KTUtil = function () {
  var e = [],
    t = function () {
      window.addEventListener("resize", (function () {
        KTUtil.throttle(undefined, (function () {
          !function () {
            for (var t = 0; t < e.length; t++) e[t].call()
          }()
        }), 200)
      }))
    };
  return {
    init: function (e) {
      t()
    },
    resize: function () {
      if ("function" == typeof Event) window.dispatchEvent(new Event("resize"));
      else {
        var e = window.document.createEvent("UIEvents");
        e.initUIEvent("resize", !0, !1, window, 0), window.dispatchEvent(e)
      }
    },
    getViewPort: function () {
      var e = window,
        t = "inner";
      return "innerWidth" in window || (t = "client", e = document.documentElement || document.body),
        {
          width: e[t + "Width"],
          height: e[t + "Height"]
        }
    },
    getUniqueId: function (e) {
      return e + Math.floor(Math.random() * (new Date)
        .getTime())
    },
    getBreakpoint: function (e) {
      var t = this.getCssVariableValue("--bs-" + e);
      return t && (t = parseInt(t.trim())), t
    },
    getHighestZindex: function (e) {
      for (var t, n; e && e !== document;) {
        if (("absolute" === (t = KTUtil.css(e, "position")) || "relative" === t || "fixed" === t) && (n = parseInt(KTUtil.css(e, "z-index")), !isNaN(n) && 0 !== n)) return n;
        e = e.parentNode
      }
      return 1
    },
    sleep: function (e) {
      for (var t = (new Date)
        .getTime(), n = 0; n < 1e7 && !((new Date)
        .getTime() - t > e); n++) ;
    },
    getRandomInt: function (e, t) {
      return Math.floor(Math.random() * (t - e + 1)) + e
    },
    deepExtend: function (e) {
      e = e || {};
      for (var t = 1; t < arguments.length; t++) {
        var n = arguments[t];
        if (n)
          for (var i in n) n.hasOwnProperty(i) && ("[object Object]" !== Object.prototype.toString.call(n[i]) ? e[i] = n[i] : e[i] = KTUtil.deepExtend(e[i], n[i]))
      }
      return e
    },
    extend: function (e) {
      e = e || {};
      for (var t = 1; t < arguments.length; t++)
        if (arguments[t])
          for (var n in arguments[t]) arguments[t].hasOwnProperty(n) && (e[n] = arguments[t][n]);
      return e
    },
    hasClass: function (e, t) {
      if (e) return e.classList ? e.classList.contains(t) : new RegExp("\\b" + t + "\\b")
        .test(e.className)
    },
    addClass: function (e, t) {
      if (e && void 0 !== t) {
        var n = t.split(" ");
        if (e.classList)
          for (var i = 0; i < n.length; i++) n[i] && n[i].length > 0 && e.classList.add(KTUtil.trim(n[i]));
        else if (!KTUtil.hasClass(e, t))
          for (var r = 0; r < n.length; r++) e.className += " " + KTUtil.trim(n[r])
      }
    },
    removeClass: function (e, t) {
      if (e && void 0 !== t) {
        var n = t.split(" ");
        if (e.classList)
          for (var i = 0; i < n.length; i++) e.classList.remove(KTUtil.trim(n[i]));
        else if (KTUtil.hasClass(e, t))
          for (var r = 0; r < n.length; r++) e.className = e.className.replace(new RegExp("\\b" + KTUtil.trim(n[r]) + "\\b", "g"), "")
      }
    },
    index: function (e) {
      for (var t = e.parentNode.children, n = 0; n < t.length; n++)
        if (t[n] == e) return n
    },
    trim: function (e) {
      return e.trim()
    },
    remove: function (e) {
      e && e.parentNode && e.parentNode.removeChild(e)
    },
    find: function (e, t) {
      return null !== e ? e.querySelector(t) : null
    },
    findAll: function (e, t) {
      return null !== e ? e.querySelectorAll(t) : null
    },
    insertAfter: function (e, t) {
      return t.parentNode.insertBefore(e, t.nextSibling)
    },
    parents: function (e, t) {
      for (var n = []; e && e !== document; e = e.parentNode) t ? e.matches(t) && n.push(e) : n.push(e);
      return n
    },
    children: function (e, t, n) {
      if (!e || !e.childNodes) return null;
      for (var i = [], r = 0, o = e.childNodes.length; r < o; ++r) 1 == e.childNodes[r].nodeType && KTUtil.matches(e.childNodes[r], t, n) && i.push(e.childNodes[r]);
      return i
    },
    child: function (e, t, n) {
      var i = KTUtil.children(e, t, n);
      return i ? i[0] : null
    },
    matches: function (e, t, n) {
      var i = Element.prototype,
        r = i.matches || i.webkitMatchesSelector || i.mozMatchesSelector || i.msMatchesSelector || function (e) {
          return -1 !== [].indexOf.call(document.querySelectorAll(e), this)
        };
      return !(!e || !e.tagName) && r.call(e, t)
    },
    data: function (e) {
      return {
        set: function (t, n) {
          e && (void 0 === e.customDataTag && (window.KTUtilElementDataStoreID++, e.customDataTag = window.KTUtilElementDataStoreID), void 0 === window.KTUtilElementDataStore[e.customDataTag] && (window.KTUtilElementDataStore[e.customDataTag] = {}), window.KTUtilElementDataStore[e.customDataTag][t] = n)
        },
        get: function (t) {
          if (e) return void 0 === e.customDataTag ? null : this.has(t) ? window.KTUtilElementDataStore[e.customDataTag][t] : null
        },
        has: function (t) {
          return !!e && (void 0 !== e.customDataTag && !(!window.KTUtilElementDataStore[e.customDataTag] || !window.KTUtilElementDataStore[e.customDataTag][t]))
        },
        remove: function (t) {
          e && this.has(t) && delete window.KTUtilElementDataStore[e.customDataTag][t]
        }
      }
    },
    offset: function (e) {
      var t, n;
      if (e) return e.getClientRects()
        .length ? (t = e.getBoundingClientRect(), n = e.ownerDocument.defaultView,
          {
            top: t.top + n.pageYOffset,
            left: t.left + n.pageXOffset,
            right: window.innerWidth - (e.offsetLeft + e.offsetWidth)
          }) :
        {
          top: 0,
          left: 0
        }
    },
    height: function (e) {
      return KTUtil.css(e, "height")
    },
    visible: function (e) {
      return !(0 === e.offsetWidth && 0 === e.offsetHeight)
    },
    attr: function (e, t, n) {
      if (null != e) return void 0 === n ? e.getAttribute(t) : void e.setAttribute(t, n)
    },
    animate: function (e, t, n, i, r, o) {
      var a = {};
      if (a.linear = function (e, t, n, i) {
        return n * e / i + t
      }, r = a.linear, "number" == typeof e && "number" == typeof t && "number" == typeof n && "function" == typeof i) {
        "function" != typeof o && (o = function () {
        });
        var l = window.requestAnimationFrame || function (e) {
            window.setTimeout(e, 20)
          },
          s = t - e;
        i(e);
        var u = window.performance && window.performance.now ? window.performance.now() : +new Date;
        l((function a(d) {
          var c = (d || +new Date) - u;
          c >= 0 && i(r(c, e, s, n)), c >= 0 && c >= n ? (i(t), o()) : l(a)
        }))
      }
    },
    actualCss: function (e, t, n) {
      var i, r = "";
      if (e instanceof HTMLElement != !1) return e.getAttribute("kt-hidden-" + t) && !1 !== n ? parseFloat(e.getAttribute("kt-hidden-" + t)) : (r = e.style.cssText, e.style.cssText = "position: absolute; visibility: hidden; display: block;", "width" == t ? i = e.offsetWidth : "height" == t && (i = e.offsetHeight), e.style.cssText = r, e.setAttribute("kt-hidden-" + t, i), parseFloat(i))
    },
    actualHeight: function (e, t) {
      return KTUtil.actualCss(e, "height", t)
    },
    css: function (e, t, n, i) {
      if (e)
        if (void 0 !== n) !0 === i ? e.style.setProperty(t, n, "important") : e.style[t] = n;
        else {
          var r = (e.ownerDocument || document)
            .defaultView;
          if (r && r.getComputedStyle) return t = t.replace(/([A-Z])/g, "-$1")
            .toLowerCase(), r.getComputedStyle(e, null)
            .getPropertyValue(t);
          if (e.currentStyle) return t = t.replace(/\-(\w)/g, (function (e, t) {
            return t.toUpperCase()
          })), n = e.currentStyle[t], /^\d+(em|pt|%|ex)?$/i.test(n) ? function (t) {
            var n = e.style.left,
              i = e.runtimeStyle.left;
            return e.runtimeStyle.left = e.currentStyle.left, e.style.left = t || 0, t = e.style.pixelLeft + "px", e.style.left = n, e.runtimeStyle.left = i, t
          }(n) : n
        }
    },
    slide: function (e, t, n, i, r) {
      if (!(!e || "up" == t && !1 === KTUtil.visible(e) || "down" == t && !0 === KTUtil.visible(e))) {
        n = n || 600;
        var o = KTUtil.actualHeight(e),
          a = !1,
          l = !1;
        KTUtil.css(e, "padding-top") && !0 !== KTUtil.data(e)
          .has("slide-padding-top") && KTUtil.data(e)
          .set("slide-padding-top", KTUtil.css(e, "padding-top")), KTUtil.css(e, "padding-bottom") && !0 !== KTUtil.data(e)
          .has("slide-padding-bottom") && KTUtil.data(e)
          .set("slide-padding-bottom", KTUtil.css(e, "padding-bottom")), KTUtil.data(e)
          .has("slide-padding-top") && (a = parseInt(KTUtil.data(e)
          .get("slide-padding-top"))), KTUtil.data(e)
          .has("slide-padding-bottom") && (l = parseInt(KTUtil.data(e)
          .get("slide-padding-bottom"))), "up" == t ? (e.style.cssText = "display: block; overflow: hidden;", a && KTUtil.animate(0, a, n, (function (t) {
          e.style.paddingTop = a - t + "px"
        }), "linear"), l && KTUtil.animate(0, l, n, (function (t) {
          e.style.paddingBottom = l - t + "px"
        }), "linear"), KTUtil.animate(0, o, n, (function (t) {
          e.style.height = o - t + "px"
        }), "linear", (function () {
          e.style.height = "", e.style.display = "none", "function" == typeof i && i()
        }))) : "down" == t && (e.style.cssText = "display: block; overflow: hidden;", a && KTUtil.animate(0, a, n, (function (t) {
          e.style.paddingTop = t + "px"
        }), "linear", (function () {
          e.style.paddingTop = ""
        })), l && KTUtil.animate(0, l, n, (function (t) {
          e.style.paddingBottom = t + "px"
        }), "linear", (function () {
          e.style.paddingBottom = ""
        })), KTUtil.animate(0, o, n, (function (t) {
          e.style.height = t + "px"
        }), "linear", (function () {
          e.style.height = "", e.style.display = "", e.style.overflow = "", "function" == typeof i && i()
        })))
      }
    },
    slideUp: function (e, t, n) {
      KTUtil.slide(e, "up", t, n)
    },
    slideDown: function (e, t, n) {
      KTUtil.slide(e, "down", t, n)
    },
    show: function (e, t) {
      void 0 !== e && (e.style.display = t || "block")
    },
    hide: function (e) {
      void 0 !== e && (e.style.display = "none")
    },
    addEvent: function (e, t, n, i) {
      null != e && e.addEventListener(t, n)
    },
    removeEvent: function (e, t, n) {
      null !== e && e.removeEventListener(t, n)
    },
    on: function (e, t, n, i) {
      if (null !== e) {
        var r = KTUtil.getUniqueId("event");
        return window.KTUtilDelegatedEventHandlers[r] = function (n) {
          for (var r = e.querySelectorAll(t), o = n.target; o && o !== e;) {
            for (var a = 0, l = r.length; a < l; a++) o === r[a] && i.call(o, n);
            o = o.parentNode
          }
        }, KTUtil.addEvent(e, n, window.KTUtilDelegatedEventHandlers[r]), r
      }
    },
    off: function (e, t, n) {
      e && window.KTUtilDelegatedEventHandlers[n] && (KTUtil.removeEvent(e, t, window.KTUtilDelegatedEventHandlers[n]), delete window.KTUtilDelegatedEventHandlers[n])
    },
    one: function (e, t, n) {
      e.addEventListener(t, (function t(i) {
        return i.target && i.target.removeEventListener && i.target.removeEventListener(i.type, t), e && e.removeEventListener && i.currentTarget.removeEventListener(i.type, t), n(i)
      }))
    },
    hash: function (e) {
      var t, n = 0;
      if (0 === e.length) return n;
      for (t = 0; t < e.length; t++) n = (n << 5) - n + e.charCodeAt(t), n |= 0;
      return n
    },
    animateClass: function (e, t, n) {
      var i, r = {
        animation: "animationend",
        OAnimation: "oAnimationEnd",
        MozAnimation: "mozAnimationEnd",
        WebkitAnimation: "webkitAnimationEnd",
        msAnimation: "msAnimationEnd"
      };
      for (var o in r) void 0 !== e.style[o] && (i = r[o]);
      KTUtil.addClass(e, t), KTUtil.one(e, i, (function () {
        KTUtil.removeClass(e, t)
      })), n && KTUtil.one(e, i, n)
    },
    isEmpty: function (e) {
      for (var t in e)
        if (e.hasOwnProperty(t)) return !1;
      return !0
    },
    snakeToCamel: function (e) {
      return e.replace(/(\-\w)/g, (function (e) {
        return e[1].toUpperCase()
      }))
    },
    getScrollTop: function () {
      return (document.scrollingElement || document.documentElement)
        .scrollTop
    },
    throttle: function (e, t, n) {
      e || (e = setTimeout((function () {
        t(), e = void 0
      }), n))
    },
    parseJson: function (e) {
      if ("string" == typeof e) {
        var t = (e = e.replace(/'/g, '"'))
          .replace(/(\w+:)|(\w+ :)/g, (function (e) {
            return '"' + e.substring(0, e.length - 1) + '":'
          }));
        try {
          e = JSON.parse(t)
        } catch (e) {
        }
      }
      return e
    },
    getResponsiveValue: function (e, t) {
      var n, i = this.getViewPort()
        .width;
      if ("object" == typeof (e = KTUtil.parseJson(e))) {
        var r, o, a = -1;
        for (var l in e) (o = "default" === l ? 0 : this.getBreakpoint(l) ? this.getBreakpoint(l) : parseInt(l)) <= i && o > a && (r = l, a = o);
        n = r ? e[r] : e
      } else n = e;
      return n
    },
    each: function (e, t) {
      return [].slice.call(e)
        .map(t)
    },
    getCssVariableValue: function (e) {
      var t = getComputedStyle(document.documentElement)
        .getPropertyValue(e);
      return t && t.length > 0 && (t = t.trim()), t
    },
    onDOMContentLoaded: function (e) {
      "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", e) : e()
    },
  }
}();
"undefined" != typeof module && void 0 !== module.exports && (module.exports = KTUtil);

var KTToggle = function (e, t) {
  var n = this;
  document.getElementsByTagName("BODY")[0];
  if (e) {
    var i = {
        saveState: !0
      },
      r = function () {
        n.options = KTUtil.deepExtend({}, i, t), n.uid = KTUtil.getUniqueId("toggle"), n.element = e, n.target = document.querySelector(n.element.getAttribute("data-kt-toggle-target")) ? document.querySelector(n.element.getAttribute("data-kt-toggle-target")) : n.element, n.state = n.element.hasAttribute("data-kt-toggle-state") ? n.element.getAttribute("data-kt-toggle-state") : "", n.attribute = "data-kt-" + n.element.getAttribute("data-kt-toggle-name"), o(), KTUtil.data(n.element)
          .set("toggle", n)
      },
      o = function () {
        KTUtil.addEvent(n.element, "click", (function (e) {
          e.preventDefault(), a()
        }))
      },
      a = function () {
        return KTEventHandler.trigger(n.element, "kt.toggle.change", n), u() ? s() : l(), KTEventHandler.trigger(n.element, "kt.toggle.changed", n), n
      },
      l = function () {
        if (!0 !== u()) return KTEventHandler.trigger(n.element, "kt.toggle.enable", n), n.target.setAttribute(n.attribute, "on"), n.state.length > 0 && n.element.classList.add(n.state), KTEventHandler.trigger(n.element, "kt.toggle.enabled", n), n
      },
      s = function () {
        if (!1 !== u()) return KTEventHandler.trigger(n.element, "kt.toggle.disable", n), n.target.removeAttribute(n.attribute), n.state.length > 0 && n.element.classList.remove(n.state), KTEventHandler.trigger(n.element, "kt.toggle.disabled", n), n
      },
      u = function () {
        return "on" === String(n.target.getAttribute(n.attribute))
          .toLowerCase()
      };
    !0 === KTUtil.data(e)
      .has("toggle") ? n = KTUtil.data(e)
      .get("toggle") : r(), n.toggle = function () {
      return a()
    }, n.enable = function () {
      return l()
    }, n.disable = function () {
      return s()
    }, n.isEnabled = function () {
      return u()
    }, n.goElement = function () {
      return n.element
    }, n.destroy = function () {
      KTUtil.data(n.element)
        .remove("toggle")
    }, n.on = function (e, t) {
      return KTEventHandler.on(n.element, e, t)
    }, n.one = function (e, t) {
      return KTEventHandler.one(n.element, e, t)
    }, n.off = function (e) {
      return KTEventHandler.off(n.element, e)
    }, n.trigger = function (e, t) {
      return KTEventHandler.trigger(n.element, e, t, n, t)
    }
  }
};
KTToggle.getInstance = function (e) {
  return null !== e && KTUtil.data(e)
    .has("toggle") ? KTUtil.data(e)
    .get("toggle") : null
}, KTToggle.createInstances = function (e = "[data-kt-toggle]") {
  var t = document.getElementsByTagName("BODY")[0].querySelectorAll(e);
  if (t && t.length > 0)
    for (var n = 0, i = t.length; n < i; n++) new KTToggle(t[n])
}, KTToggle.init = function () {
  KTToggle.createInstances()
}, "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", KTToggle.init) : KTToggle.init(), "undefined" != typeof module && void 0 !== module.exports && (module.exports = KTToggle), Element.prototype.matches || (Element.prototype.matches = function (e) {
  for (var t = (this.document || this.ownerDocument)
    .querySelectorAll(e), n = t.length; --n >= 0 && t.item(n) !== this;) ;
  return n > -1
}), Element.prototype.closest || (Element.prototype.closest = function (e) {
  var t = this;
  if (!document.documentElement.contains(this)) return null;
  do {
    if (t.matches(e)) return t;
    t = t.parentElement
  } while (null !== t);
  return null
}),
  function (e) {
    for (var t = 0; t < e.length; t++) window[e[t]] && !("remove" in window[e[t]].prototype) && (window[e[t]].prototype.remove = function () {
      this.parentNode.removeChild(this)
    })
  }(["Element", "CharacterData", "DocumentType"]),
  function () {
    for (var e = 0, t = ["webkit", "moz"], n = 0; n < t.length && !window.requestAnimationFrame; ++n) window.requestAnimationFrame = window[t[n] + "RequestAnimationFrame"], window.cancelAnimationFrame = window[t[n] + "CancelAnimationFrame"] || window[t[n] + "CancelRequestAnimationFrame"];
    window.requestAnimationFrame || (window.requestAnimationFrame = function (t) {
      var n = (new Date)
          .getTime(),
        i = Math.max(0, 16 - (n - e)),
        r = window.setTimeout((function () {
          t(n + i)
        }), i);
      return e = n + i, r
    }), window.cancelAnimationFrame || (window.cancelAnimationFrame = function (e) {
      clearTimeout(e)
    })
  }(), [Element.prototype, Document.prototype, DocumentFragment.prototype].forEach((function (e) {
  e.hasOwnProperty("prepend") || Object.defineProperty(e, "prepend",
    {
      configurable: !0,
      enumerable: !0,
      writable: !0,
      value: function () {
        var e = Array.prototype.slice.call(arguments),
          t = document.createDocumentFragment();
        e.forEach((function (e) {
          var n = e instanceof Node;
          t.appendChild(n ? e : document.createTextNode(String(e)))
        })), this.insertBefore(t, this.firstChild)
      }
    })
})), null == Element.prototype.getAttributeNames && (Element.prototype.getAttributeNames = function () {
  for (var e = this.attributes, t = e.length, n = new Array(t), i = 0; i < t; i++) n[i] = e[i].name;
  return n
}), window.KTUtilElementDataStore = {}, window.KTUtilElementDataStoreID = 0, window.KTUtilDelegatedEventHandlers = {};



var KTDrawer = function (e, t) {
  var n = this,
    i = document.getElementsByTagName("BODY")[0];
  if (null != e) {
    var r = {
        overlay: !0,
        direction: "end",
        baseClass: "drawer",
        overlayClass: "drawer-overlay"
      },
      o = function () {
        n.options = KTUtil.deepExtend({}, r, t), n.uid = KTUtil.getUniqueId("drawer"), n.element = e, n.overlayElement = null, n.name = n.element.getAttribute("data-kt-drawer-name"), n.shown = !1, n.lastWidth, n.toggleElement = null, n.element.setAttribute("data-kt-drawer", "true"), a(), d(), KTUtil.data(n.element)
          .set("drawer", n)
      },
      a = function () {
        var e = f("toggle"),
          t = f("close");
        null !== e && e.length > 0 && KTUtil.on(i, e, "click", (function (e) {
          e.preventDefault(), n.toggleElement = this, l()
        })), null !== t && t.length > 0 && KTUtil.on(i, t, "click", (function (e) {
          e.preventDefault(), n.closeElement = this, s()
        }))
      },
      l = function () {
        !1 !== KTEventHandler.trigger(n.element, "kt.drawer.toggle", n) && (!0 === n.shown ? s() : u(), KTEventHandler.trigger(n.element, "kt.drawer.toggled", n))
      },
      s = function () {
        !1 !== KTEventHandler.trigger(n.element, "kt.drawer.hide", n) && (n.shown = !1, m(), i.removeAttribute("data-kt-drawer-" + n.name, "on"), i.removeAttribute("data-kt-drawer"), KTUtil.removeClass(n.element, n.options.baseClass + "-on"), null !== n.toggleElement && KTUtil.removeClass(n.toggleElement, "active"), KTEventHandler.trigger(n.element, "kt.drawer.after.hidden", n))
      },
      u = function () {
        !1 !== KTEventHandler.trigger(n.element, "kt.drawer.show", n) && (n.shown = !0, c(), i.setAttribute("data-kt-drawer-" + n.name, "on"), i.setAttribute("data-kt-drawer", "on"), KTUtil.addClass(n.element, n.options.baseClass + "-on"), null !== n.toggleElement && KTUtil.addClass(n.toggleElement, "active"), KTEventHandler.trigger(n.element, "kt.drawer.shown", n))
      },
      d = function () {
        var e = g(),
          t = f("direction");
        !0 === KTUtil.hasClass(n.element, n.options.baseClass + "-on") && "on" === String(i.getAttribute("data-kt-drawer-" + n.name + "-")) ? n.shown = !0 : n.shown = !1, !0 === f("activate") ? (KTUtil.addClass(n.element, n.options.baseClass), KTUtil.addClass(n.element, n.options.baseClass + "-" + t), KTUtil.css(n.element, "width", e, !0), n.lastWidth = e) : (KTUtil.css(n.element, "width", ""), KTUtil.removeClass(n.element, n.options.baseClass), KTUtil.removeClass(n.element, n.options.baseClass + "-" + t), s())
      },
      c = function () {
        !0 === f("overlay") && (n.overlayElement = document.createElement("DIV"), KTUtil.css(n.overlayElement, "z-index", KTUtil.css(n.element, "z-index") - 1), i.append(n.overlayElement), KTUtil.addClass(n.overlayElement, f("overlay-class")), KTUtil.addEvent(n.overlayElement, "click", (function (e) {
          e.preventDefault(), s()
        })))
      },
      m = function () {
        null !== n.overlayElement && KTUtil.remove(n.overlayElement)
      },
      f = function (e) {
        if (!0 === n.element.hasAttribute("data-kt-drawer-" + e)) {
          var t = n.element.getAttribute("data-kt-drawer-" + e),
            i = KTUtil.getResponsiveValue(t);
          return null !== i && "true" === String(i) ? i = !0 : null !== i && "false" === String(i) && (i = !1), i
        }
        var r = KTUtil.snakeToCamel(e);
        return n.options[r] ? KTUtil.getResponsiveValue(n.options[r]) : null
      },
      g = function () {
        var e = f("width");
        return "auto" === e && (e = KTUtil.css(n.element, "width")), e
      };
    KTUtil.data(e)
      .has("drawer") ? n = KTUtil.data(e)
      .get("drawer") : o(), n.toggle = function () {
      return l()
    }, n.show = function () {
      return u()
    }, n.hide = function () {
      return s()
    }, n.isShown = function () {
      return n.shown
    }, n.update = function () {
      d()
    }, n.goElement = function () {
      return n.element
    }, n.destroy = function () {
      KTUtil.data(n.element)
        .remove("drawer")
    }, n.on = function (e, t) {
      return KTEventHandler.on(n.element, e, t)
    }, n.one = function (e, t) {
      return KTEventHandler.one(n.element, e, t)
    }, n.off = function (e) {
      return KTEventHandler.off(n.element, e)
    }, n.trigger = function (e, t) {
      return KTEventHandler.trigger(n.element, e, t, n, t)
    }
  }
};
KTDrawer.getInstance = function (e) {
  return null !== e && KTUtil.data(e)
    .has("drawer") ? KTUtil.data(e)
    .get("drawer") : null
}, KTDrawer.hideAll = function (e = null, t = '[data-kt-drawer="true"]') {
  var n = document.querySelectorAll(t);
  if (n && n.length > 0)
    for (var i = 0, r = n.length; i < r; i++) {
      var o = n[i],
        a = KTDrawer.getInstance(o);
      a && (e ? o !== e && a.hide() : a.hide())
    }
}, KTDrawer.updateAll = function (e = '[data-kt-drawer="true"]') {
  var t = document.querySelectorAll(e);
  if (t && t.length > 0)
    for (var n = 0, i = t.length; n < i; n++) {
      var r = t[n],
        o = KTDrawer.getInstance(r);
      o && o.update()
    }
}, KTDrawer.createInstances = function (e = '[data-kt-drawer="true"]') {
  var t = document.getElementsByTagName("BODY")[0].querySelectorAll(e);
  if (t && t.length > 0)
    for (var n = 0, i = t.length; n < i; n++) new KTDrawer(t[n])
}, KTDrawer.handleShow = function () {
  KTUtil.on(document.body, '[data-kt-drawer-show="true"][data-kt-drawer-target]', "click", (function (e) {

    var t = document.querySelector(this.getAttribute("data-kt-drawer-target"));
    t && KTDrawer.getInstance(t)
      .show()
  }))
}, KTDrawer.handleDismiss = function () {
  KTUtil.on(document.body, '[data-kt-drawer-dismiss="true"]', "click", (function (e) {
    var t = this.closest('[data-kt-drawer="true"]');
    if (t) {
      var n = KTDrawer.getInstance(t);
      n.isShown() && n.hide()
    }
  }))
}, window.addEventListener("resize", (function () {
  var e = document.getElementsByTagName("BODY")[0];
  KTUtil.throttle(undefined, (function () {
    var t = e.querySelectorAll('[data-kt-drawer="true"]');
    if (t && t.length > 0)
      for (var n = 0, i = t.length; n < i; n++) {
        var r = KTDrawer.getInstance(t[n]);
        r && r.update()
      }
  }), 200)
})), KTDrawer.init = function () {
  KTDrawer.createInstances(), KTDrawer.handleShow(), KTDrawer.handleDismiss()
}, "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", KTDrawer.init) : KTDrawer.init(), "undefined" != typeof module && void 0 !== module.exports && (module.exports = KTDrawer);
var KTEventHandler = function () {
  var e = {},
    t = function (t, n, i, r) {
      var o = KTUtil.getUniqueId("event");
      KTUtil.data(t)
        .set(n, o), e[n] || (e[n] = {}), e[n][o] = {
        name: n,
        callback: i,
        one: r,
        fired: !1
      }
    };
  return {
    trigger: function (t, n, i, r) {
      return function (t, n, i, r) {
        if (!0 === KTUtil.data(t)
          .has(n)) {
          var o = KTUtil.data(t)
            .get(n);
          if (e[n] && e[n][o]) {
            var a = e[n][o];
            if (a.name === n) {
              if (1 != a.one) return a.callback.call(this, i, r);
              if (0 == a.fired) return e[n][o].fired = !0, a.callback.call(this, i, r)
            }
          }
        }
        return null
      }(t, n, i, r)
    },
    on: function (e, n, i) {
      return t(e, n, i)
    },
    one: function (e, n, i) {
      return t(e, n, i, !0)
    },
    off: function (t, n) {
      return function (t, n) {
        var i = KTUtil.data(t)
          .get(n);
        e[n] && e[n][i] && delete e[n][i]
      }(t, n)
    },
    debug: function () {
      for (var t in e) e.hasOwnProperty(t) && console.log(t)
    }
  }
}();
"undefined" != typeof module && void 0 !== module.exports && (module.exports = KTEventHandler);


// Class definition
var KTScroll = function (element, options) {
  ////////////////////////////
  // ** Private Variables  ** //
  ////////////////////////////
  var the = this;
  var body = document.getElementsByTagName("BODY")[0];

  if (!element) {
    return;
  }

  // Default options
  var defaultOptions = {
    saveState: true
  };

  ////////////////////////////
  // ** Private Methods  ** //
  ////////////////////////////

  var _construct = function () {
    if (KTUtil.data(element).has('scroll')) {
      the = KTUtil.data(element).get('scroll');
    } else {
      _init();
    }
  }

  var _init = function () {
    // Variables
    the.options = KTUtil.deepExtend({}, defaultOptions, options);

    // Elements
    the.element = element;
    the.id = the.element.getAttribute('id');

    // Set initialized
    the.element.setAttribute('data-kt-scroll', 'true');

    // Update
    _update();

    // Bind Instance
    KTUtil.data(the.element).set('scroll', the);
  }

  var _setupHeight = function () {
    var heightType = _getHeightType();
    var height = _getHeight();

    // Set height
    if (height !== null && height.length > 0) {
      KTUtil.css(the.element, heightType, height);
    } else {
      KTUtil.css(the.element, heightType, '');
    }
  }

  var _setupState = function () {
    if (_getOption('save-state') === true && typeof KTCookie !== 'undefined' && the.id) {
      if (KTCookie.get(the.id + 'st')) {
        var pos = parseInt(KTCookie.get(the.id + 'st'));

        if (pos > 0) {
          the.element.scrollTop = pos;
        }
      }
    }
  }

  var _setupScrollHandler = function () {
    if (_getOption('save-state') === true && typeof KTCookie !== 'undefined' && the.id) {
      the.element.addEventListener('scroll', _scrollHandler);
    } else {
      the.element.removeEventListener('scroll', _scrollHandler);
    }
  }

  var _destroyScrollHandler = function () {
    the.element.removeEventListener('scroll', _scrollHandler);
  }

  var _resetHeight = function () {
    KTUtil.css(the.element, _getHeightType(), '');
  }

  var _scrollHandler = function () {
    KTCookie.set(the.id + 'st', the.element.scrollTop);
  }

  var _update = function () {
    // Activate/deactivate
    if (_getOption('activate') === true || the.element.hasAttribute('data-kt-scroll-activate') === false) {
      _setupHeight();
      _setupScrollHandler();
      _setupState();
    } else {
      _resetHeight()
      _destroyScrollHandler();
    }
  }

  var _getHeight = function () {
    var height = _getOption(_getHeightType());

    if (height instanceof Function) {
      return height.call();
    } else if (height !== null && typeof height === 'string' && height.toLowerCase() === 'auto') {
      return _getAutoHeight();
    } else {
      return height;
    }
  }

  var _getAutoHeight = function () {
    var height = KTUtil.getViewPort().height;

    var dependencies = _getOption('dependencies');
    var wrappers = _getOption('wrappers');
    var offset = _getOption('offset');

    // Height dependencies
    if (dependencies !== null) {
      var elements = document.querySelectorAll(dependencies);

      if (elements && elements.length > 0) {
        for (var i = 0, len = elements.length; i < len; i++) {
          var element = elements[i];

          if (KTUtil.visible(element) === false) {
            continue;
          }

          height = height - parseInt(KTUtil.css(element, 'height'));
          height = height - parseInt(KTUtil.css(element, 'margin-top'));
          height = height - parseInt(KTUtil.css(element, 'margin-bottom'));

          if (KTUtil.css(element, 'border-top')) {
            height = height - parseInt(KTUtil.css(element, 'border-top'));
          }

          if (KTUtil.css(element, 'border-bottom')) {
            height = height - parseInt(KTUtil.css(element, 'border-bottom'));
          }
        }
      }
    }

    // Wrappers
    if (wrappers !== null) {
      var elements = document.querySelectorAll(wrappers);
      if (elements && elements.length > 0) {
        for (var i = 0, len = elements.length; i < len; i++) {
          var element = elements[i];

          if (KTUtil.visible(element) === false) {
            continue;
          }

          height = height - parseInt(KTUtil.css(element, 'margin-top'));
          height = height - parseInt(KTUtil.css(element, 'margin-bottom'));
          height = height - parseInt(KTUtil.css(element, 'padding-top'));
          height = height - parseInt(KTUtil.css(element, 'padding-bottom'));

          if (KTUtil.css(element, 'border-top')) {
            height = height - parseInt(KTUtil.css(element, 'border-top'));
          }

          if (KTUtil.css(element, 'border-bottom')) {
            height = height - parseInt(KTUtil.css(element, 'border-bottom'));
          }
        }
      }
    }

    // Custom offset
    if (offset !== null) {
      height = height - parseInt(offset);
    }

    height = height - parseInt(KTUtil.css(the.element, 'margin-top'));
    height = height - parseInt(KTUtil.css(the.element, 'margin-bottom'));

    if (KTUtil.css(element, 'border-top')) {
      height = height - parseInt(KTUtil.css(element, 'border-top'));
    }

    if (KTUtil.css(element, 'border-bottom')) {
      height = height - parseInt(KTUtil.css(element, 'border-bottom'));
    }

    height = String(height) + 'px';

    return height;
  }

  var _getOption = function (name) {
    if (the.element.hasAttribute('data-kt-scroll-' + name) === true) {
      var attr = the.element.getAttribute('data-kt-scroll-' + name);

      var value = KTUtil.getResponsiveValue(attr);

      if (value !== null && String(value) === 'true') {
        value = true;
      } else if (value !== null && String(value) === 'false') {
        value = false;
      }

      return value;
    } else {
      var optionName = KTUtil.snakeToCamel(name);

      if (the.options[optionName]) {
        return KTUtil.getResponsiveValue(the.options[optionName]);
      } else {
        return null;
      }
    }
  }

  var _getHeightType = function () {
    if (_getOption('height')) {
      return 'height';
    }
    if (_getOption('min-height')) {
      return 'min-height';
    }
    if (_getOption('max-height')) {
      return 'max-height';
    }
  }

  var _destroy = function () {
    KTUtil.data(the.element).remove('scroll');
  }

  // Construct Class
  _construct();

  ///////////////////////
  // ** Public API  ** //
  ///////////////////////

  the.update = function () {
    return _update();
  }

  the.getHeight = function () {
    return _getHeight();
  }

  the.getElement = function () {
    return the.element;
  }

  the.destroy = function () {
    return _destroy();
  }
};

// Static methods
KTScroll.getInstance = function (element) {
  if (element !== null && KTUtil.data(element).has('scroll')) {
    return KTUtil.data(element).get('scroll');
  } else {
    return null;
  }
}

// Create instances
KTScroll.createInstances = function (selector = '[data-kt-scroll="true"]') {
  var body = document.getElementsByTagName("BODY")[0];
  // Initialize Menus
  var elements = body.querySelectorAll(selector);

  if (elements && elements.length > 0) {
    for (var i = 0, len = elements.length; i < len; i++) {
      new KTScroll(elements[i]);
    }
  }
}

// Window resize handling
window.addEventListener('resize', function () {
  var timer;
  var body = document.getElementsByTagName("BODY")[0];

  KTUtil.throttle(timer, function () {
    // Locate and update Offcanvas instances on window resize
    var elements = body.querySelectorAll('[data-kt-scroll="true"]');

    if (elements && elements.length > 0) {
      for (var i = 0, len = elements.length; i < len; i++) {
        var scroll = KTScroll.getInstance(elements[i]);
        if (scroll) {
          scroll.update();
        }
      }
    }
  }, 200);
});

// Global initialization
KTScroll.init = function () {
  KTScroll.createInstances();
};

// On document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', KTScroll.init);
} else {
  KTScroll.init();
}

// Webpack Support
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = KTScroll;
}


"use strict";

// Class definition
var KTSticky = function (element, options) {
  ////////////////////////////
  // ** Private Variables  ** //
  ////////////////////////////
  var the = this;
  var body = document.getElementsByTagName("BODY")[0];

  if (typeof element === "undefined" || element === null) {
    return;
  }

  // Default Options
  var defaultOptions = {
    offset: 200,
    flipOffset: 0,
    reverse: false,
    animation: true,
    animationSpeed: '0.3s',
    animationClass: 'animation-slide-in-down'
  };
  ////////////////////////////
  // ** Private Methods  ** //
  ////////////////////////////

  var _construct = function () {
    if (KTUtil.data(element).has('sticky') === true) {
      the = KTUtil.data(element).get('sticky');
    } else {
      _init();
    }
  }

  var _init = function () {
    the.element = element;
    the.options = KTUtil.deepExtend({}, defaultOptions, options);
    the.uid = KTUtil.getUniqueId('sticky');
    the.name = the.element.getAttribute('data-kt-sticky-name');
    the.attributeName = 'data-kt-sticky-' + the.name;
    the.eventTriggerState = true;
    the.lastScrollTop = 0;
    the.scrollHandler;

    // Set initialized
    the.element.setAttribute('data-kt-sticky', 'true');

    // Event Handlers
    window.addEventListener('scroll', _scroll);

    // Initial Launch
    _scroll();

    // Bind Instance
    KTUtil.data(the.element).set('sticky', the);
  }

  var _scroll = function (e) {
    var offset = _getOption('offset');
    var reverse = _getOption('reverse');
    var st;
    var attrName;
    var diff;

    // Exit if false
    if (offset === false) {
      return;
    }

    offset = parseInt(offset);
    st = KTUtil.getScrollTop();

    if (reverse === true) {  // Release on reverse scroll mode
      if (st > offset) {
        if (body.hasAttribute(the.attributeName) === false) {
          _enable();
          body.setAttribute(the.attributeName, 'on');
        }

        if (the.eventTriggerState === true) {
          KTEventHandler.trigger(the.element, 'kt.sticky.on', the);
          KTEventHandler.trigger(the.element, 'kt.sticky.change', the);

          the.eventTriggerState = false;
        }
      } else { // Back scroll mode
        if (body.hasAttribute(the.attributeName) === true) {
          _disable();
          body.removeAttribute(the.attributeName);
        }

        if (the.eventTriggerState === false) {
          KTEventHandler.trigger(the.element, 'kt.sticky.off', the);
          KTEventHandler.trigger(the.element, 'kt.sticky.change', the);
          the.eventTriggerState = true;
        }
      }

      the.lastScrollTop = st;
    } else { // Classic scroll mode
      if (st > offset) {
        if (body.hasAttribute(the.attributeName) === false) {
          _enable();
          body.setAttribute(the.attributeName, 'on');
        }

        if (the.eventTriggerState === true) {
          KTEventHandler.trigger(the.element, 'kt.sticky.on', the);
          KTEventHandler.trigger(the.element, 'kt.sticky.change', the);
          the.eventTriggerState = false;
        }
      } else { // back scroll mode
        if (body.hasAttribute(the.attributeName) === true) {
          _disable();
          body.removeAttribute(the.attributeName);
        }

        if (the.eventTriggerState === false) {
          KTEventHandler.trigger(the.element, 'kt.sticky.off', the);
          KTEventHandler.trigger(the.element, 'kt.sticky.change', the);
          the.eventTriggerState = true;
        }
      }
    }

    //_flip();
  }

  var _enable = function (update) {
    var top = _getOption('top');
    var left = _getOption('left');
    var right = _getOption('right');
    var width = _getOption('width');
    var zindex = _getOption('zindex');

    if (update !== true && _getOption('animation') === true) {
      KTUtil.css(the.element, 'animationDuration', _getOption('animationSpeed'));
      KTUtil.animateClass(the.element, 'animation ' + _getOption('animationClass'));
    }

    if (zindex !== null) {
      KTUtil.css(the.element, 'z-index', zindex);
      KTUtil.css(the.element, 'position', 'fixed');
    }

    if (top !== null) {
      KTUtil.css(the.element, 'top', top);
    }

    if (width !== null) {
      if (width['target']) {
        var targetElement = document.querySelector(width['target']);
        if (targetElement) {
          width = KTUtil.css(targetElement, 'width');
        }
      }

      KTUtil.css(the.element, 'width', width);
    }

    if (left !== null) {
      if (String(left).toLowerCase() === 'auto') {
        var offsetLeft = KTUtil.offset(the.element).left;

        if (offsetLeft > 0) {
          KTUtil.css(the.element, 'left', String(offsetLeft) + 'px');
        }
      }
    }
  }

  var _disable = function () {
    KTUtil.css(the.element, 'top', '');
    KTUtil.css(the.element, 'width', '');
    KTUtil.css(the.element, 'left', '');
    KTUtil.css(the.element, 'right', '');
    KTUtil.css(the.element, 'z-index', '');
    KTUtil.css(the.element, 'position', '');
  }

  var _flip = function () {
    var flipOffset = _getOption('flip-offset');
    var flipBottom = _getOption('flip-bottom');
    var diff = document.documentElement.scrollHeight - window.innerHeight - KTUtil.getScrollTop();
    flipOffset = parseInt(flipOffset);

    if (flipOffset > 0) {
      if (diff >= flipOffset) {
        KTUtil.css(the.element, 'top', top);
        KTUtil.css(the.element, 'bottom', 'auto');
      } else {
        KTUtil.css(the.element, 'top', 'auto');
        KTUtil.css(the.element, 'bottom', flipBottom);
      }
    }
  }

  var _getOption = function (name) {
    if (the.element.hasAttribute('data-kt-sticky-' + name) === true) {
      var attr = the.element.getAttribute('data-kt-sticky-' + name);
      var value = KTUtil.getResponsiveValue(attr);

      if (value !== null && String(value) === 'true') {
        value = true;
      } else if (value !== null && String(value) === 'false') {
        value = false;
      }

      return value;
    } else {
      var optionName = KTUtil.snakeToCamel(name);

      if (the.options[optionName]) {
        return KTUtil.getResponsiveValue(the.options[optionName]);
      } else {
        return null;
      }
    }
  }

  var _destroy = function () {
    window.removeEventListener('scroll', _scroll);
    KTUtil.data(the.element).remove('sticky');
  }

  // Construct Class
  _construct();

  ///////////////////////
  // ** Public API  ** //
  ///////////////////////

  // Methods
  the.update = function () {
    if (body.hasAttribute(the.attributeName) === true) {
      _disable();
      body.removeAttribute(the.attributeName);
      _enable(true);
      body.setAttribute(the.attributeName, 'on');
    }
  }

  the.destroy = function () {
    return _destroy();
  }

  // Event API
  the.on = function (name, handler) {
    return KTEventHandler.on(the.element, name, handler);
  }

  the.one = function (name, handler) {
    return KTEventHandler.one(the.element, name, handler);
  }

  the.off = function (name) {
    return KTEventHandler.off(the.element, name);
  }

  the.trigger = function (name, event) {
    return KTEventHandler.trigger(the.element, name, event, the, event);
  }
};

// Static methods
KTSticky.getInstance = function (element) {
  if (element !== null && KTUtil.data(element).has('sticky')) {
    return KTUtil.data(element).get('sticky');
  } else {
    return null;
  }
}

// Create instances
KTSticky.createInstances = function (selector = '[data-kt-sticky="true"]') {
  var body = document.getElementsByTagName("BODY")[0];

  // Initialize Menus
  var elements = body.querySelectorAll(selector);
  var sticky;

  if (elements && elements.length > 0) {
    for (var i = 0, len = elements.length; i < len; i++) {
      sticky = new KTSticky(elements[i]);
    }
  }
}

// Window resize handler
window.addEventListener('resize', function () {
  var timer;
  var body = document.getElementsByTagName("BODY")[0];

  KTUtil.throttle(timer, function () {
    // Locate and update Offcanvas instances on window resize
    var elements = body.querySelectorAll('[data-kt-sticky="true"]');

    if (elements && elements.length > 0) {
      for (var i = 0, len = elements.length; i < len; i++) {
        var sticky = KTSticky.getInstance(elements[i]);
        if (sticky) {
          sticky.update();
        }
      }
    }
  }, 200);
});

// Global initialization
KTSticky.init = function () {
  KTSticky.createInstances();
};

// On document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', KTSticky.init);
} else {
  KTSticky.init();
}

// Webpack support
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = KTSticky;
}

