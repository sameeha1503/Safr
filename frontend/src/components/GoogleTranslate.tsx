import { useEffect, useState, useRef } from "react";
import { Globe, Loader2 } from "lucide-react";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateService?: {
          getInstance: () => { restore: () => void } | undefined;
        };
        TranslateElement?: new (
          options: {
            pageLanguage: string;
            includedLanguages: string;
            autoDisplay: boolean;
          },
          elementId: string,
        ) => object;
      };
    };
  }
}

/**
 * Temporarily block every way JavaScript can trigger a full page reload.
 * Google Translate's internal `el_main.js` calls `location.reload()` after
 * setting the `googtrans` cookie.  We intercept that so the inline DOM
 * translation still applies but the page never actually refreshes.
 *
 * Returns a `restore` function that puts everything back.
 */
function blockPageReloads(): () => void {
  const origReload = Location.prototype.reload;
  const origAssign = Location.prototype.assign;
  const origReplace = Location.prototype.replace;
  const origHistoryGo = History.prototype.go;

  Location.prototype.reload = function () {};

  Location.prototype.assign = function (url: string) {
    try {
      if (new URL(url, window.location.href).href === window.location.href)
        return;
    } catch {
      /* allow */
    }
    origAssign.call(this, url);
  };

  Location.prototype.replace = function (url: string) {
    try {
      if (new URL(url, window.location.href).href === window.location.href)
        return;
    } catch {
      /* allow */
    }
    origReplace.call(this, url);
  };

  History.prototype.go = function (delta?: number) {
    if (!delta) return; // go(0) is a reload
    origHistoryGo.call(this, delta);
  };

  return () => {
    Location.prototype.reload = origReload;
    Location.prototype.assign = origAssign;
    Location.prototype.replace = origReplace;
    History.prototype.go = origHistoryGo;
  };
}

const INCLUDED_LANGUAGES = "en,hi,gom,kok,mr,gu,bn,te,ta,kn,ml,pa,ur,or,as";

export function GoogleTranslate() {
  const [lang, setLang] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const restoreReloadsRef = useRef<(() => void) | null>(null);

  // Helper to read cookie
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift();
    return undefined;
  };

  // Helper to clear googtrans cookie thoroughly across all domain/path variants
  const clearGoogTransCookie = () => {
    const hostname = window.location.hostname;
    const domains = ["", hostname, `.${hostname}`];
    const parts = hostname.split(".");
    if (parts.length > 2) {
      const rootDomain = parts.slice(-2).join(".");
      domains.push(`.${rootDomain}`);
      domains.push(rootDomain);
    }
    const paths = ["/", ""];
    const expire = "expires=Thu, 01 Jan 1970 00:00:00 UTC;";

    for (const d of domains) {
      for (const p of paths) {
        const dStr = d ? ` domain=${d};` : "";
        const pStr = p ? ` path=${p};` : "";
        document.cookie = `googtrans=; ${expire}${pStr}${dStr}`;
      }
    }
  };

  // Helper to set googtrans cookie across root path and domain variants
  const setGoogTransCookie = (targetLang: string) => {
    if (targetLang === "en") {
      clearGoogTransCookie();
      return;
    }

    const cookieVal = `/en/${targetLang}`;
    const hostname = window.location.hostname;

    // Set for current path & root
    document.cookie = `googtrans=${cookieVal}; path=/;`;
    document.cookie = `googtrans=${cookieVal}; path=/; domain=${hostname};`;

    const parts = hostname.split(".");
    if (parts.length > 2) {
      const rootDomain = parts.slice(-2).join(".");
      document.cookie = `googtrans=${cookieVal}; path=/; domain=.${rootDomain};`;
    }
  };

  // Read initial language from local storage or Google Translate cookie if it exists
  useEffect(() => {
    try {
      const saved = localStorage.getItem("safr_selected_lang");
      if (saved) {
        setLang(saved);
        if (saved === "en") clearGoogTransCookie();
        return;
      }
    } catch {
      // ignore
    }

    const googtrans = getCookie("googtrans");
    if (googtrans) {
      const langCode = googtrans.split("/").pop();
      if (langCode && langCode !== "en") {
        setLang(langCode);
      } else {
        setLang("en");
        clearGoogTransCookie();
      }
    }
  }, []);

  // Initialize Google Translate widget globally
  useEffect(() => {
    let container = document.getElementById("google_translate_element");
    if (!container) {
      container = document.createElement("div");
      container.id = "google_translate_element";
      // Position offscreen so the browser fully evaluates layout and renders options
      container.style.position = "fixed";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.width = "1px";
      container.style.height = "1px";
      container.style.opacity = "0";
      container.style.pointerEvents = "none";
      container.style.zIndex = "-1000";
      document.body.appendChild(container);
    }

    const initWidget = () => {
      if (window.google?.translate?.TranslateElement) {
        const el = document.getElementById("google_translate_element");
        if (el && el.children.length === 0) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: INCLUDED_LANGUAGES,
              autoDisplay: false,
            },
            "google_translate_element",
          );
        }
      }
    };

    window.googleTranslateElementInit = initWidget;

    if (window.google?.translate?.TranslateElement) {
      initWidget();
    } else if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src =
        "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Ensure reloads are restored on unmount
      if (restoreReloadsRef.current) {
        restoreReloadsRef.current();
        restoreReloadsRef.current = null;
      }
    };
  }, []);

  const triggerTranslation = (targetLang: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Always release previous reload interception if any
    if (restoreReloadsRef.current) {
      restoreReloadsRef.current();
      restoreReloadsRef.current = null;
    }

    setLang(targetLang);

    // ── Switching back to English: instant in-place restore without page reload ──
    if (targetLang === "en") {
      try {
        localStorage.setItem("safr_selected_lang", "en");
      } catch {
        // ignore
      }
      clearGoogTransCookie();

      // Block any page reload Google Translate might attempt internally
      const restoreReloads = blockPageReloads();
      restoreReloadsRef.current = restoreReloads;
      setTimeout(() => {
        restoreReloads();
        if (restoreReloadsRef.current === restoreReloads) {
          restoreReloadsRef.current = null;
        }
      }, 5000);

      // 1. Try Google Translate internal TranslateService restore if present
      try {
        const svc = window.google?.translate?.TranslateService;
        if (svc) {
          svc.getInstance()?.restore();
        }
      } catch {
        // ignore
      }

      // 2. Try Google Translate restore button in banner frame / skiptranslate iframe
      try {
        const frames = Array.from(
          document.querySelectorAll<HTMLIFrameElement>(
            "iframe.goog-te-banner-frame, iframe.skiptranslate, iframe[id*='goog']",
          ),
        );
        for (const frame of frames) {
          try {
            const frameDoc =
              frame.contentDocument || frame.contentWindow?.document;
            if (frameDoc) {
              const restoreBtn = frameDoc.querySelector<HTMLElement>(
                ".goog-te-button button, [id*='restore'], .goog-te-restore, #\\:1\\.restore",
              );
              if (restoreBtn) {
                restoreBtn.click();
              }
            }
          } catch {
            // frame cross-origin catch
          }
        }
      } catch {
        // ignore
      }

      // 3. Reset the combo element to English/Select Language
      const select = document.querySelector(
        ".goog-te-combo",
      ) as HTMLSelectElement | null;
      if (select) {
        const enOpt = Array.from(select.options).find(
          (o) =>
            o.value === "" ||
            o.value === "en" ||
            o.text.toLowerCase().includes("select language") ||
            o.text.toLowerCase().includes("english"),
        );
        if (enOpt) {
          select.value = enOpt.value;
        } else {
          select.selectedIndex = 0;
        }
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.dispatchEvent(new Event("input", { bubbles: true }));
      }

      setIsTranslating(false);
      return;
    }

    // ── Switching to a non-English language ──
    try {
      localStorage.setItem("safr_selected_lang", targetLang);
    } catch {
      // ignore
    }

    // Block full-page reload for seamless in-place translation
    const restoreReloads = blockPageReloads();
    restoreReloadsRef.current = restoreReloads;

    // Automatically restore after 8s so reloads are never permanently blocked
    setTimeout(() => {
      restoreReloads();
      if (restoreReloadsRef.current === restoreReloads) {
        restoreReloadsRef.current = null;
      }
    }, 8000);

    // Set cookie
    setGoogTransCookie(targetLang);

    // Apply translation for non-English languages
    const tryApply = (): boolean => {
      const select = document.querySelector(
        ".goog-te-combo",
      ) as HTMLSelectElement | null;
      if (!select || select.options.length === 0) return false;

      const options = Array.from(select.options);
      // Build candidate list: for Konkani try gom → kok
      const candidates = targetLang === "gom" ? ["gom", "kok"] : [targetLang];
      const matched = options.find((opt) => candidates.includes(opt.value));

      if (matched) {
        select.value = matched.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      return false;
    };

    // If options are already loaded, trigger immediately
    if (tryApply()) {
      setIsTranslating(false);
      return;
    }

    // Otherwise, poll while Google Translate fetches options asynchronously
    setIsTranslating(true);
    let attempts = 0;
    pollIntervalRef.current = setInterval(() => {
      attempts++;
      if (tryApply()) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsTranslating(false);
        return;
      }

      // After 40 attempts (4s), stop gracefully
      if (attempts >= 40) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setIsTranslating(false);
      }
    }, 100);
  };

  return (
    <div className="notranslate relative inline-flex items-center overflow-hidden rounded-full border border-orange-500/30 bg-white/60 px-3 py-1.5 shadow-sm backdrop-blur-md transition-all hover:bg-white/90 hover:shadow-md">
      {isTranslating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-orange-600" />
      ) : (
        <Globe className="mr-2 h-4 w-4 text-orange-600" />
      )}
      <select
        aria-label="Page language"
        value={lang}
        onChange={(e) => triggerTranslation(e.target.value)}
        className="bg-transparent text-sm font-bold text-orange-700 outline-none cursor-pointer appearance-none pr-4"
      >
        <option value="en">English</option>
        <option value="gom">कोंकणी (Konkani)</option>
        <option value="hi">हिंदी (Hindi)</option>
        <option value="mr">मराठी (Marathi)</option>
        <option value="gu">ગુજરાતી (Gujarati)</option>
        <option value="bn">বাংলা (Bengali)</option>
        <option value="te">తెలుగు (Telugu)</option>
        <option value="ta">தமிழ் (Tamil)</option>
        <option value="kn">ಕನ್ನಡ (Kannada)</option>
        <option value="ml">മലയാളം (Malayalam)</option>
      </select>

      {/* Custom dropdown arrow */}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <svg
          className="h-3 w-3 text-orange-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {/* Global CSS to hide Google Translate top bar and popups */}
      <style>{`
        body { top: 0 !important; position: static !important; }
        .goog-te-banner-frame, iframe.goog-te-banner-frame { display: none !important; pointer-events: none !important; }
        .skiptranslate, .skiptranslate iframe, iframe.skiptranslate { pointer-events: none !important; }
        .skiptranslate:not(.notranslate) { display: none !important; }
        #goog-gt-tt, .goog-te-balloon-frame, .VIpgJd-yAWdn-mAjFeg { display: none !important; pointer-events: none !important; }
        .goog-te-spinner-pos, .goog-te-spinner-animation { display: none !important; pointer-events: none !important; }
        .notranslate, .notranslate select { pointer-events: auto !important; }
      `}</style>
    </div>
  );
}
