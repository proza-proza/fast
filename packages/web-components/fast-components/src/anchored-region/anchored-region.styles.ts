import { css } from "@microsoft/fast-element";

export const AnchoredRegionStyles = css`
    :host {
        contain: layout;
        display: block;
    }

    :host(.loading) {
        pointer-events: "none";
        opacity: 0;
    }
`;
