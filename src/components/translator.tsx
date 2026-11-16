"use client";

import { useEffect } from "react";
import { translateAm } from "@/lib/i18n/am";
import type { Lang } from "@/lib/i18n/lang";

const ATTRS = ["placeholder", "aria-label", "title"] as const;
const SKIP = "script, style, textarea, code, [translate='no'], .notranslate";

function skip(el: Element | null) {
  return !el || !!el.closest(SKIP);
}

/** Replace a text node's English with Amharic, keeping surrounding spaces. */
function translateText(node: Text) {
  const raw = node.nodeValue;
  if (!raw || skip(node.parentElement)) return;
  const t = translateAm(raw);
  if (t === null) return;
  const lead = raw.match(/^\s*/)![0];
  const trail = raw.match(/\s*$/)![0];
  const next = lead + t + trail;
  if (next !== raw) node.nodeValue = next;
}

function translateAttrs(el: Element) {
  if (skip(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const t = translateAm(v);
    if (t !== null && t !== v) el.setAttribute(a, t);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (!(root instanceof Element)) return;
  translateAttrs(root);
  root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(translateAttrs);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) translateText(n as Text);
}

function translateTitle() {
  const [page, ...rest] = document.title.split(" · ");
  const t = translateAm(page);
  if (t) document.title = [t, ...rest].join(" · ");
}

/**
 * When Amharic is on, swaps the app's English UI text for Amharic in the browser, and keeps doing so
 * as React renders new content. Product names and other data aren't in the dictionary, so they stay as typed.
 */
export function Translator({ lang }: { lang: Lang }) {
  useEffect(() => {
    const html = document.documentElement;
    if (lang !== "am") {
      html.setAttribute("data-i18n-ready", "");
      return;
    }
    translateTree(document.body);
    translateTitle();
    html.setAttribute("data-i18n-ready", "");

    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") translateText(r.target as Text);
        else if (r.type === "attributes") translateAttrs(r.target as Element);
        else r.addedNodes.forEach(translateTree);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    const titleObs = new MutationObserver(translateTitle);
    const titleEl = document.querySelector("title");
    if (titleEl) titleObs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      obs.disconnect();
      titleObs.disconnect();
    };
  }, [lang]);
  return null;
}
