import { attr, DOM, FASTElement, observable } from "@microsoft/fast-element";
// TODO: the Resize Observer related files are a temporary stopgap measure until
// Resize Observer types are pulled into TypeScript, which seems imminent
// At that point these files should be deleted.
// https://github.com/microsoft/TypeScript/issues/37861
import {
    ConstructibleResizeObserver,
    ResizeObserverClassDefinition,
} from "../anchored-region/resize-observer";
import { ResizeObserverEntry } from "../anchored-region/resize-observer-entry";

declare global {
    interface WindowWithResizeObserver extends Window {
        ResizeObserver: ConstructibleResizeObserver;
    }
}

/**
 * The views types for a horizontal-scroll {@link @microsoft/fast-foundation#(HorizontalScroll:class)}
 * @public
 */
export type HorizontalScrollView = "default" | "mobile";

/**
 * A HorizontalScroll Custom HTML Element
 * @public
 */
export class HorizontalScroll extends FASTElement {
    /**
     * Reference to DOM element containing the content to scroll
     * @public
     */
    public contentContainer: HTMLDivElement;

    /**
     * Reference to flipper to scroll to previous content
     * @public
     */
    public previousFlipper: HTMLDivElement;

    /**
     * Reference to flipper to scroll to the next content
     * @public
     */
    public nextFlipper: HTMLDivElement;

    /**
     * Detects if the component has been resized
     * @internal
     */
    private resizeDetector: ResizeObserverClassDefinition | null = null;

    /**
     * Current scroll position
     * @internal
     */
    @attr
    private position: number;

    /**
     * Width of the parent container
     * @internal
     */
    @attr
    private width: number;

    /**
     * Scroll stop positions between elements
     * @internal
     */
    @attr
    private scrollStops: Array<number>;

    /**
     * View: default | mobile
     * @public
     */
    @attr({
        attribute: "view",
    })
    public view: HorizontalScrollView;

    /**
     * @public
     */
    public connectedCallback(): void {
        super.connectedCallback();
        DOM.queueUpdate(this.setStops.bind(this));
        this.initializeResizeDetector();
        this.startObservers();
    }

    /**
     * @public
     */
    public disconnectedCallback(): void {
        super.disconnectedCallback();

        this.disconnectResizeDetector();
    }

    /**
     * Starts observers
     * @internal
     */
    private startObservers = (): void => {
        this.stopObservers();

        if (this.resizeDetector !== null) {
            this.resizeDetector.observe(this);
        }
    };

    /**
     * Stops observers
     * @internal
     */
    private stopObservers = (): void => {
        if (this.resizeDetector !== null) {
            this.resizeDetector.disconnect();
        }
    };

    /**
     * destroys the instance's resize observer
     * @internal
     */
    private disconnectResizeDetector(): void {
        this.stopObservers();

        if (this.resizeDetector !== null) {
            this.resizeDetector.disconnect();
            this.resizeDetector = null;
        }
    }

    /**
     * initializes the instance's resize observer
     * @internal
     */
    private initializeResizeDetector(): void {
        this.disconnectResizeDetector();
        this.resizeDetector = new ((window as unknown) as WindowWithResizeObserver).ResizeObserver(
            this.handleResize.bind(this)
        );
    }

    /**
     * Handle resize events
     * @internal
     */
    private handleResize = (entries: ResizeObserverEntry[]): void => {
        entries.forEach((entry: ResizeObserverEntry) => {
            if (entry.target === this) {
                this.setStops();
            }
        });
    };

    /**
     * Finds all of the scroll stops between elements
     * @internal
     */
    private setStops(): void {
        this.width = this.offsetWidth;
        let lastStop: number = 0;
        const scrollItems: Array<any> = [].slice
            .call(this.children)
            /* filter out non-default slots */
            .filter(
                (el: Element): boolean =>
                    !el.getAttribute("slot") || el.getAttribute("slot") === "default"
            );

        /* RTL items will come in reverse offsetLeft */
        const isRtl: boolean =
            scrollItems.length > 1 &&
            scrollItems[0].offsetLeft > scrollItems[1].offsetLeft;

        const stops = scrollItems.map(
            (
                { offsetLeft: left, offsetWidth: width }: any,
                idx: number,
                ary: Array<any>
            ): number => {
                const firstLtr: boolean = !isRtl && idx === 0;
                const lastRtl: boolean = isRtl && idx === ary.length - 1;

                /* Getting the final stop after the last item or before the first RTL item */
                if (!isRtl || idx === 0) {
                    lastStop = (left + width) * (isRtl ? 1 : -1);
                }

                /* Remove extra margin on first item and last RTL item */
                if (lastRtl || firstLtr) {
                    left = 0;
                } else if (!isRtl) {
                    /* account for negative position for LTR */
                    left = 0 - left;
                }

                return left;
            }
        );

        stops.push(lastStop);

        /* Sort to zero */
        stops.sort((a, b) => Math.abs(a) - Math.abs(b));

        this.scrollStops = stops;
        this.moveToStart();
    }

    /**
     * Sets the controls view if enabled
     * @internal
     */
    private setFlippers(): void {
        if (this.previousFlipper && this.nextFlipper) {
            this.previousFlipper.classList.toggle("disabled", this.position === 0);
            const lastStop: number = this.scrollStops[this.scrollStops.length - 1];
            this.nextFlipper.classList.toggle(
                "disabled",
                Math.abs(this.position) + this.width >= Math.abs(lastStop)
            );
        }
    }

    /**
     * Scrolls items to the left
     * @public
     */
    public scrollToPrevious(): void {
        const current: number = this.scrollStops.findIndex(
            (stop: number): boolean => stop === this.position
        );
        const right: number = this.scrollStops[current + 1];
        const nextIndex: number =
            this.scrollStops.findIndex(
                (stop: number): boolean => Math.abs(stop) + this.width > Math.abs(right)
            ) || 0;
        const left = this.scrollStops[
            nextIndex < current ? nextIndex : current > 0 ? current - 1 : 0
        ];
        this.contentContainer.style.transform = `translate3d(${left}px, 0, 0)`;
        this.position = left;
        this.setFlippers();
    }

    /**
     * Scrolls items to the right
     * @public
     */
    public scrollToNext(): void {
        const current: number = this.scrollStops.findIndex(
            (stop: number): boolean => stop === this.position
        );
        const outOfView: number = this.scrollStops.findIndex(
            (stop: number): boolean =>
                Math.abs(stop) >= Math.abs(this.position) + this.width
        );
        let nextIndex = current;
        if (outOfView > current + 2) {
            nextIndex = outOfView - 2;
        } else if (current < this.scrollStops.length - 2) {
            nextIndex = current + 1;
        }
        const nextStop: number = this.scrollStops[nextIndex];
        this.contentContainer.style.transform = `translate3d(${nextStop}px, 0, 0)`;
        this.position = nextStop;
        this.setFlippers();
    }

    /**
     * Move the index back to the zero position
     * @public
     */
    public moveToStart(): void {
        this.position = 0;
        this.contentContainer.style.transform = "translate3d(0, 0, 0)";
        this.setFlippers();
    }
}
