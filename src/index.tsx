import { createEffect, createMemo, createSignal, For, JSX, mergeProps, onCleanup, onMount, Show } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';

import { CloseIcon, getAsset, Loader } from './assets';
import { useIsDocumentHidden } from './hooks';
import { toast, ToastState } from './state';
import './styles.css';
import {
  isAction,
  type Position,
  type SwipeDirection,
  type ExternalToast,
  type HeightT,
  type ToasterProps,
  type ToastProps,
  type ToastT,
  type ToastToDismiss,
} from './types';

// Visible toasts amount
const VISIBLE_TOASTS_AMOUNT = 3;

// Viewport padding
const VIEWPORT_OFFSET = '24px';

// Mobile viewport padding
const MOBILE_VIEWPORT_OFFSET = '16px';

// Default lifetime of a toasts (in ms)
const TOAST_LIFETIME = 4000;

// Default toast width
const TOAST_WIDTH = 356;

// Default gap between toasts
const GAP = 14;

// Threshold to dismiss a toast
const SWIPE_THRESHOLD = 45;

// Equal to exit animation duration
const TIME_BEFORE_UNMOUNT = 200;

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function getDefaultSwipeDirections(position: string): SwipeDirection[] {
  const [y, x] = position.split('-');
  const directions: SwipeDirection[] = [];

  if (y) {
    directions.push(y as SwipeDirection);
  }

  if (x) {
    directions.push(x as SwipeDirection);
  }

  return directions;
}

const [heights, setHeights] = createSignal<HeightT[]>([]);

const Toast = (props: ToastProps) => {
  const [swipeDirection, setSwipeDirection] = createSignal<'x' | 'y' | null>(null);
  const [swipeOutDirection, setSwipeOutDirection] = createSignal<'left' | 'right' | 'up' | 'down' | null>(null);
  const [mounted, setMounted] = createSignal(false);
  const [removed, setRemoved] = createSignal(false);
  const [swiping, setSwiping] = createSignal(false);
  const [swipeOut, setSwipeOut] = createSignal(false);
  const [isSwiped, setIsSwiped] = createSignal(false);
  const [offsetBeforeRemove, setOffsetBeforeRemove] = createSignal(0);
  const [initialHeight, setInitialHeight] = createSignal(0);

  // eslint-disable-next-line solid/reactivity
  let remainingTime = props.toast.duration ?? props.duration ?? TOAST_LIFETIME;
  let dragStartTime: Date | null = null;
  let toastRef!: HTMLLIElement;

  const isFront = () => props.index === 0;
  const isVisible = () => props.index + 1 <= props.visibleToasts;

  // Height index is used to calculate the offset as it gets updated before the toast array, which means we can calculate the new layout faster.
  const heightIndex = () => heights().findIndex((height) => height.toastId === props.toast.id) || 0;
  const closeButton = createMemo(() => props.toast.closeButton ?? props.closeButton);

  let closeTimerStartTimeRef = 0;
  let lastCloseTimerStartTimeRef = 0;
  let pointerStartRef: { x: number; y: number } | null = null;

  const coords = () => props.position.split('-');

  const toastsHeightBefore = createMemo(() => {
    let total = 0;
    for (let i = 0; i < heights().length; i++) {
      if (i >= heightIndex()) break;
      total += heights()[i].height;
    }
    return total;
  });

  const isDocumentHidden = useIsDocumentHidden();

  const invert = () => props.toast.invert ?? props.invert;
  const isLoading = () => props.toast.type === 'loading';

  const offset = createMemo(() => heightIndex() * props.gap + toastsHeightBefore());

  onMount(() => {
    setMounted(true);
  });

  onMount(() => {
    const originalHeight = toastRef.style.height;
    toastRef.style.height = 'auto';
    const newHeight = toastRef.getBoundingClientRect().height;
    toastRef.style.height = originalHeight;

    setInitialHeight(newHeight);

    createEffect(() => {
      const toastId = props.toast.id;
      const position = props.toast.position ?? props.position;
      setHeights((heights) => {
        const alreadyExists = heights.find((height) => height.toastId === toastId);
        if (!alreadyExists) {
          return [{ toastId, height: newHeight, position }, ...heights];
        } else {
          return heights.map((height) => (height.toastId === toastId ? { ...height, height: newHeight } : height));
        }
      });
    });
  });

  const deleteToast = () => {
    // Save the offset for the exit swipe animation
    setRemoved(true);
    setOffsetBeforeRemove(offset());
    setHeights((h) => h.filter((height) => height.toastId !== props.toast.id));

    setTimeout(() => {
      props.removeToast(props.toast);
    }, TIME_BEFORE_UNMOUNT);
  };

  createEffect(() => {
    if (props.toast.duration === Infinity || isLoading()) return;
    let timeoutId: NodeJS.Timeout;

    // Pause the timer on each hover
    const pauseTimer = () => {
      if (lastCloseTimerStartTimeRef < closeTimerStartTimeRef) {
        // Get the elapsed time since the timer started
        const elapsedTime = new Date().getTime() - closeTimerStartTimeRef;

        remainingTime = remainingTime - elapsedTime;
      }

      lastCloseTimerStartTimeRef = new Date().getTime();
    };

    const startTimer = () => {
      // setTimeout(, Infinity) behaves as if the delay is 0.
      // As a result, the toast would be closed immediately, giving the appearance that it was never rendered.
      // See: https://github.com/denysdovhan/wtfjs?tab=readme-ov-file#an-infinite-timeout
      if (remainingTime === Infinity) return;

      closeTimerStartTimeRef = new Date().getTime();

      // Let the toast know it has started
      timeoutId = setTimeout(() => {
        props.toast.onAutoClose?.(props.toast);
        deleteToast();
      }, remainingTime);
    };

    if (props.expanded || props.interacting || isDocumentHidden()) {
      pauseTimer();
    } else {
      startTimer();
    }

    onCleanup(() => {
      clearTimeout(timeoutId);
    });
  });

  createEffect(() => {
    if (props.toast.delete) {
      deleteToast();
    }
  });

  function getLoadingIcon() {
    if (props.icons?.loading) {
      return (
        <div
          class={cn(props.classNames?.loader, props.toast.classNames?.loader, 'sonner-loader')}
          data-visible={isLoading()}
        >
          {props.icons.loading}
        </div>
      );
    }

    return <Loader class={cn(props.classNames?.loader, props.toast.classNames?.loader)} visible={isLoading()} />;
  }

  const icon = () =>
    props.toast.icon ?? (props.toast.type ? (props.icons?.[props.toast.type] ?? getAsset(props.toast.type)()) : null);

  return (
    <li
      tabIndex={0}
      ref={toastRef}
      class={cn(
        props.class,
        props.toast.className,
        props.classNames?.toast,
        props.toast.classNames?.toast,
        props.classNames?.default,
        ...(props.toast.type ? [props.classNames?.[props.toast.type], props.toast.classNames?.[props.toast.type]] : []),
      )}
      data-sonner-toast=""
      data-rich-colors={props.toast.richColors ?? props.defaultRichColors}
      data-styled={!(props.toast.jsx ?? props.toast.unstyled ?? props.unstyled)}
      data-mounted={mounted()}
      data-promise={Boolean(toast.promise)}
      data-swiped={isSwiped()}
      data-removed={removed()}
      data-visible={isVisible()}
      data-y-position={coords()[0]}
      data-x-position={coords()[1]}
      data-index={props.index}
      data-front={isFront()}
      data-swiping={swiping()}
      data-dismissible={props.toast.dismissible}
      data-type={props.toast.type}
      data-invert={invert()}
      data-swipe-out={swipeOut()}
      data-swipe-direction={swipeOutDirection()}
      data-expanded={Boolean(props.expanded || (props.expandByDefault && mounted()))}
      style={{
        '--index': props.index,
        '--toasts-before': props.index,
        '--z-index': props.toasts.length - props.index,
        '--offset': `${removed() ? offsetBeforeRemove() : offset()}px`,
        '--initial-height': props.expandByDefault ? 'auto' : `${initialHeight()}px`,
        ...props.style,
        ...props.toast.style,
      }}
      onDragEnd={() => {
        setSwiping(false);
        setSwipeDirection(null);
        pointerStartRef = null;
      }}
      onPointerDown={(event) => {
        if (isLoading() || !props.toast.dismissible) return;
        dragStartTime = new Date();
        setOffsetBeforeRemove(offset());
        // Ensure we maintain correct pointer capture even when going outside of the toast (e.g. when swiping)
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        if ((event.target as HTMLElement).tagName === 'BUTTON') return;
        setSwiping(true);
        pointerStartRef = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={() => {
        if (swipeOut() || !props.toast.dismissible || !dragStartTime) return;

        pointerStartRef = null;

        const swipeAmountX = Number(toastRef.style.getPropertyValue('--swipe-amount-x').replace('px', ''));
        const swipeAmountY = Number(toastRef.style.getPropertyValue('--swipe-amount-y').replace('px', ''));
        const timeTaken = new Date().getTime() - dragStartTime.getTime();

        const swipeAmount = swipeDirection() === 'x' ? swipeAmountX : swipeAmountY;
        const velocity = Math.abs(swipeAmount) / timeTaken;

        if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) {
          setOffsetBeforeRemove(offset());
          props.toast.onDismiss?.(props.toast);

          if (swipeDirection() === 'x') {
            setSwipeOutDirection(swipeAmountX > 0 ? 'right' : 'left');
          } else {
            setSwipeOutDirection(swipeAmountY > 0 ? 'down' : 'up');
          }

          deleteToast();
          setSwipeOut(true);

          return;
        } else {
          toastRef.style.setProperty('--swipe-amount-x', `0px`);
          toastRef.style.setProperty('--swipe-amount-y', `0px`);
        }
        setIsSwiped(false);
        setSwiping(false);
        setSwipeDirection(null);
      }}
      onPointerMove={(event) => {
        if (!pointerStartRef || !props.toast.dismissible) return;

        const isHighlighted = (window.getSelection()?.toString().length ?? 0) > 0;
        if (isHighlighted) return;

        const yDelta = event.clientY - pointerStartRef.y;
        const xDelta = event.clientX - pointerStartRef.x;

        const swipeDirections = props.swipeDirections ?? getDefaultSwipeDirections(props.position);

        // Determine swipe direction if not already locked
        if (!swipeDirection() && (Math.abs(xDelta) > 1 || Math.abs(yDelta) > 1)) {
          setSwipeDirection(Math.abs(xDelta) > Math.abs(yDelta) ? 'x' : 'y');
        }

        const swipeAmount = { x: 0, y: 0 };

        const getDampening = (delta: number) => {
          const factor = Math.abs(delta) / 20;

          return 1 / (1.5 + factor);
        };

        // Only apply swipe in the locked direction
        if (swipeDirection() === 'y') {
          // Handle vertical swipes
          if (swipeDirections.includes('top') || swipeDirections.includes('bottom')) {
            if ((swipeDirections.includes('top') && yDelta < 0) || (swipeDirections.includes('bottom') && yDelta > 0)) {
              swipeAmount.y = yDelta;
            } else {
              // Smoothly transition to dampened movement
              const dampenedDelta = yDelta * getDampening(yDelta);
              // Ensure we don't jump when transitioning to dampened movement
              swipeAmount.y = Math.abs(dampenedDelta) < Math.abs(yDelta) ? dampenedDelta : yDelta;
            }
          }
        } else if (swipeDirection() === 'x') {
          // Handle horizontal swipes
          if (swipeDirections.includes('left') || swipeDirections.includes('right')) {
            if ((swipeDirections.includes('left') && xDelta < 0) || (swipeDirections.includes('right') && xDelta > 0)) {
              swipeAmount.x = xDelta;
            } else {
              // Smoothly transition to dampened movement
              const dampenedDelta = xDelta * getDampening(xDelta);
              // Ensure we don't jump when transitioning to dampened movement
              swipeAmount.x = Math.abs(dampenedDelta) < Math.abs(xDelta) ? dampenedDelta : xDelta;
            }
          }
        }

        if (Math.abs(swipeAmount.x) > 0 || Math.abs(swipeAmount.y) > 0) {
          setIsSwiped(true);
        }

        // Apply transform using both x and y values
        toastRef.style.setProperty('--swipe-amount-x', `${swipeAmount.x}px`);
        toastRef.style.setProperty('--swipe-amount-y', `${swipeAmount.y}px`);
      }}
    >
      <Show when={closeButton() && !props.toast.jsx && !isLoading()}>
        <button
          aria-label={props.closeButtonAriaLabel}
          data-disabled={isLoading()}
          data-close-button
          onClick={() => {
            if (isLoading() || !props.toast.dismissible) return;
            deleteToast();
            props.toast.onDismiss?.(props.toast);
          }}
          class={cn(props.classNames?.closeButton, props.toast.classNames?.closeButton)}
        >
          {props.icons?.close ?? <CloseIcon />}
        </button>
      </Show>

      <Show when={props.toast.type ?? props.toast.icon ?? toast.promise}>
        <div data-icon="" class={cn(props.classNames?.icon, props.toast.classNames?.icon)}>
          <Show when={props.toast.promise ?? (isLoading() && !props.toast.icon)}>
            {props.toast.icon ?? getLoadingIcon()}
          </Show>
          <Show when={!isLoading()}>{icon()}</Show>
        </div>
      </Show>

      <div data-content="" class={cn(props.classNames?.content, props.toast.classNames?.content)}>
        <div data-title="" class={cn(props.classNames?.title, props.toast.classNames?.title)}>
          {props.toast.jsx ?? props.toast.title}
        </div>
        <Show when={props.toast.description}>
          <div
            data-description=""
            class={cn(
              props.descriptionClassName,
              props.toast.descriptionClassName,
              props.classNames?.description,
              props.toast.classNames?.description,
            )}
          >
            {props.toast.description}
          </div>
        </Show>
      </div>

      <Show when={isAction(props.toast.cancel) && props.toast.cancel}>
        {(el) => (
          <button
            data-button
            data-cancel
            style={props.toast.cancelButtonStyle ?? props.cancelButtonStyle}
            onClick={(event) => {
              if (!props.toast.dismissible) return;
              el().onClick(event);
              deleteToast();
            }}
            class={cn(props.classNames?.cancelButton, props.toast.classNames?.cancelButton)}
          >
            {el().label}
          </button>
        )}
      </Show>

      <Show when={isAction(props.toast.action) && props.toast.action}>
        {(el) => (
          <button
            data-button
            data-action
            style={props.toast.actionButtonStyle ?? props.actionButtonStyle}
            onClick={(event) => {
              el().onClick(event);
              if (event.defaultPrevented) return;
              deleteToast();
            }}
            class={cn(props.classNames?.actionButton, props.toast.classNames?.actionButton)}
          >
            {el().label}
          </button>
        )}
      </Show>
    </li>
  );
};

function getDocumentDirection(): ToasterProps['dir'] {
  if (typeof window === 'undefined') return 'ltr';
  if (typeof document === 'undefined') return 'ltr'; // For Fresh purpose

  const dirAttribute = document.documentElement.getAttribute('dir');

  if (dirAttribute === 'auto' || !dirAttribute) {
    return window.getComputedStyle(document.documentElement).direction as ToasterProps['dir'];
  }

  return dirAttribute as ToasterProps['dir'];
}

function assignOffset(defaultOffset: ToasterProps['offset'], mobileOffset: ToasterProps['mobileOffset']) {
  const styles: JSX.CSSProperties = {};

  [defaultOffset, mobileOffset].forEach((offset, index) => {
    const isMobile = index === 1;
    const prefix = isMobile ? '--mobile-offset' : '--offset';
    const defaultValue = isMobile ? MOBILE_VIEWPORT_OFFSET : VIEWPORT_OFFSET;

    function assignAll(offset: string | number) {
      ['top', 'right', 'bottom', 'left'].forEach((key) => {
        styles[`${prefix}-${key}`] = typeof offset === 'number' ? `${offset}px` : offset;
      });
    }

    if (typeof offset === 'number' || typeof offset === 'string') {
      assignAll(offset);
    } else if (typeof offset === 'object') {
      (['top', 'right', 'bottom', 'left'] as (keyof typeof offset)[]).forEach((key) => {
        if (offset[key] === undefined) {
          styles[`${prefix}-${key}`] = defaultValue;
        } else {
          styles[`${prefix}-${key}`] = typeof offset[key] === 'number' ? `${offset[key]}px` : offset[key];
        }
      });
    } else {
      assignAll(defaultValue);
    }
  });

  return styles;
}

function useSonner() {
  const [activeToasts, setActiveToasts] = createSignal<ToastT[]>([]);

  createEffect(() => {
    return ToastState.subscribe((toast) => {
      if ((toast as ToastToDismiss).dismiss) {
        setTimeout(() => {
          setActiveToasts((toasts) => toasts.filter((t) => t.id !== toast.id));
        });
        return;
      }

      // Prevent batching, temp solution.
      setTimeout(() => {
        setActiveToasts((toasts) => {
          const indexOfExistingToast = toasts.findIndex((t) => t.id === toast.id);

          // Update the toast if it already exists
          if (indexOfExistingToast !== -1) {
            return [
              ...toasts.slice(0, indexOfExistingToast),
              { ...toasts[indexOfExistingToast], ...toast },
              ...toasts.slice(indexOfExistingToast + 1),
            ];
          }

          return [toast, ...toasts];
        });
      });
    });
  });

  return {
    toasts: activeToasts,
  };
}

const Toaster = (propsRaw: ToasterProps, ref: HTMLElement) => {
  const props = mergeProps(
    {
      position: 'bottom-right',
      hotkey: ['altKey', 'KeyT'],
      theme: 'light',
      visibleToasts: VISIBLE_TOASTS_AMOUNT,
      dir: getDocumentDirection(),
      gap: GAP,
      containerAriaLabel: 'Notifications',
    },
    propsRaw,
  );

  /**
   * Use a store instead of a signal for fine-grained reactivity.
   * All the setters only have to change the deepest part of the tree
   * to maintain referential integrity when rendered in the DOM.
   */
  const [toastsStore, setToastsStore] = createStore<{ toasts: ToastT[] }>({ toasts: [] });
  const possiblePositions = createMemo(() => {
    return Array.from(
      new Set(
        [props.position].concat(
          toastsStore.toasts.map((toast) => toast.position).filter((position) => position !== undefined),
        ),
      ),
    );
  });

  const [expanded, setExpanded] = createSignal(false);
  const [interacting, setInteracting] = createSignal(false);
  const [actualTheme, setActualTheme] = createSignal('system');

  const hotkeyLabel = () => props.hotkey.join('+').replace(/Key/g, '').replace(/Digit/g, '');

  let listRef!: HTMLOListElement;
  let lastFocusedElementRef: HTMLElement | null = null;
  let isFocusWithinRef = false;

  const removeToast = (toastToRemove: ToastT) => {
    setToastsStore('toasts', (toasts) => {
      if (!toasts.find((toast) => toast.id === toastToRemove.id)?.delete) {
        ToastState.dismiss(toastToRemove.id);
      }

      return toasts.filter(({ id }) => id !== toastToRemove.id);
    });
  };

  onMount(() => {
    // eslint-disable-next-line solid/reactivity
    const unsub = ToastState.subscribe((toast) => {
      if ((toast as ToastToDismiss).dismiss) {
        // Prevent batching of other state updates
        requestAnimationFrame(() => {
          setToastsStore(
            'toasts',
            produce((toasts) => {
              toasts.forEach((t) => {
                if (t.id === toast.id) t.delete = true;
              });
            }),
          );
        });
        return;
      }

      // Update (Fine-grained)
      const changedIndex = toastsStore.toasts.findIndex((t) => t.id === toast.id);
      if (changedIndex !== -1) {
        setToastsStore('toasts', [changedIndex], reconcile(toast));
        return;
      }

      // Insert (Fine-grained)
      setToastsStore(
        'toasts',
        produce((toasts) => {
          toasts.unshift(toast);
        }),
      );
    });

    onCleanup(() => {
      unsub();
    });
  });

  createEffect(() => {
    if (props.theme !== 'system') {
      setActualTheme(props.theme);
      return;
    }

    setActualTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    if (typeof window === 'undefined') return;
    const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    try {
      // Chrome & Firefox
      darkMediaQuery.addEventListener('change', ({ matches }) => {
        if (matches) {
          setActualTheme('dark');
        } else {
          setActualTheme('light');
        }
      });
    } catch {
      // Safari < 14
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      darkMediaQuery.addListener(({ matches }) => {
        try {
          if (matches) {
            setActualTheme('dark');
          } else {
            setActualTheme('light');
          }
        } catch (e) {
          console.error(e);
        }
      });
    }
  });

  createEffect(() => {
    // Ensure expanded is always false when no toasts are present / only one left
    if (toastsStore.toasts.length <= 1) {
      setExpanded(false);
    }
  });

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isHotkeyPressed = props.hotkey.every((key) => event[key as keyof KeyboardEvent] ?? event.code === key);

      if (isHotkeyPressed) {
        setExpanded(true);
        listRef.focus();
      }

      if (event.code === 'Escape' && (document.activeElement === listRef || listRef.contains(document.activeElement))) {
        setExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  onCleanup(() => {
    if (lastFocusedElementRef) {
      lastFocusedElementRef.focus({ preventScroll: true });
      lastFocusedElementRef = null;
      isFocusWithinRef = false;
    }
  });

  const toastOptions = createMemo(() => props.toastOptions);

  return (
    <Show when={toastsStore.toasts.length > 0}>
      {/* Remove item from normal navigation flow, only available via hotkey */}
      <section
        ref={ref}
        aria-label={`${props.containerAriaLabel} ${hotkeyLabel()}`}
        tabIndex={-1}
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
      >
        <For each={possiblePositions()}>
          {(position, index) => {
            const [y, x] = position.split('-');

            return (
              <ol
                dir={props.dir === 'auto' ? getDocumentDirection() : props.dir}
                tabIndex={-1}
                ref={listRef}
                class={props.className}
                data-sonner-toaster
                data-sonner-theme={actualTheme()}
                data-y-position={y}
                data-lifted={expanded() && toastsStore.toasts.length > 1 && !props.expand}
                data-x-position={x}
                style={{
                  '--front-toast-height': `${heights()[0]?.height || 0}px`,
                  '--width': `${TOAST_WIDTH}px`,
                  '--gap': `${props.gap}px`,
                  ...props.style,
                  ...assignOffset(props.offset, props.mobileOffset),
                }}
                onBlur={(event) => {
                  if (isFocusWithinRef && !event.currentTarget.contains(event.relatedTarget as Node)) {
                    isFocusWithinRef = false;
                    if (lastFocusedElementRef) {
                      lastFocusedElementRef.focus({ preventScroll: true });
                      lastFocusedElementRef = null;
                    }
                  }
                }}
                onFocus={(event) => {
                  const isNotDismissible =
                    event.target instanceof HTMLElement && event.target.dataset['dismissible'] === 'false';

                  if (isNotDismissible) return;

                  if (!isFocusWithinRef) {
                    isFocusWithinRef = true;
                    lastFocusedElementRef = event.relatedTarget as HTMLElement;
                  }
                }}
                onMouseEnter={() => setExpanded(true)}
                onMouseMove={() => setExpanded(true)}
                onMouseLeave={() => {
                  // Avoid setting expanded to false when interacting with a toast, e.g. swiping
                  if (!interacting()) {
                    setExpanded(false);
                  }
                }}
                onDragEnd={() => setExpanded(false)}
                onPointerDown={(event) => {
                  const isNotDismissible =
                    event.target instanceof HTMLElement && event.target.dataset['dismissible'] === 'false';

                  if (isNotDismissible) return;
                  setInteracting(true);
                }}
                onPointerUp={() => setInteracting(false)}
              >
                <For
                  each={toastsStore.toasts.filter(
                    (toast) => (!toast.position && index() === 0) || toast.position === position,
                  )}
                >
                  {(toast, index) => (
                    <Toast
                      icons={props.icons}
                      index={index()}
                      toast={toast}
                      defaultRichColors={props.richColors}
                      duration={toastOptions()?.duration ?? props.duration}
                      class={toastOptions()?.className}
                      descriptionClassName={toastOptions()?.descriptionClassName}
                      invert={!!props.invert}
                      visibleToasts={props.visibleToasts}
                      closeButton={toastOptions()?.closeButton ?? !!props.closeButton}
                      interacting={interacting()}
                      position={props.position as Position}
                      style={toastOptions()?.style}
                      unstyled={toastOptions()?.unstyled}
                      classNames={toastOptions()?.classNames}
                      cancelButtonStyle={toastOptions()?.cancelButtonStyle}
                      actionButtonStyle={toastOptions()?.actionButtonStyle}
                      closeButtonAriaLabel={toastOptions()?.closeButtonAriaLabel}
                      removeToast={removeToast}
                      toasts={toastsStore.toasts.filter((t) => t.position === toast.position)}
                      expandByDefault={!!props.expand}
                      gap={props.gap}
                      expanded={expanded()}
                      swipeDirections={props.swipeDirections}
                    />
                  )}
                </For>
              </ol>
            );
          }}
        </For>
      </section>
    </Show>
  );
};

export { type Action, type ToastClassnames, type ToastToDismiss } from './types';
export { toast, Toaster, useSonner, type ExternalToast, type ToasterProps, type ToastT };
