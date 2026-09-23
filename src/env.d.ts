/// <reference path="../.astro/types.d.ts" />
interface Window {
  Prism?: {
    highlightAll: () => void;
    highlightElement: (el: Element) => void;
  };
}
