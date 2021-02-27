import { css } from "@microsoft/fast-element";

export const AnchoredRegionStyles = css`
    :host {
        contain: layout;
        display: block;
        pointer-events: none;
        opacity: 0;
    }

    :host(.loaded) {
        pointer-events: auto;
        opacity: 1;
    }
`;
