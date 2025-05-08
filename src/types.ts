import { JSX } from 'solid-js';

export type ToastTypes = 'normal' | 'action' | 'success' | 'info' | 'warning' | 'error' | 'loading' | 'default';

export type PromiseT<Data = unknown> = Promise<Data> | (() => Promise<Data>);

export type PromiseIExtendedResult = {
  message: JSX.Element;
} & ExternalToast;

export type PromiseTExtendedResult<Data = unknown> =
  | PromiseIExtendedResult
  | ((data: Data) => PromiseIExtendedResult | Promise<PromiseIExtendedResult>);

export type PromiseTResult<Data = unknown> = JSX.Element | ((data: Data) => JSX.Element | Promise<JSX.Element>);

export type PromiseExternalToast = Omit<ExternalToast, 'description'>;

export type PromiseData<ToastData = unknown> = PromiseExternalToast & {
  loading?: JSX.Element;
  success?: PromiseTResult<ToastData> | PromiseTExtendedResult<ToastData>;
  error?: PromiseTResult | PromiseTExtendedResult;
  description?: PromiseTResult;
  finally?: () => void | Promise<void>;
};

export type ToastClassnames = {
  toast?: string;
  title?: string;
  description?: string;
  loader?: string;
  closeButton?: string;
  cancelButton?: string;
  actionButton?: string;
  content?: string;
  icon?: string;
} & Record<ToastTypes, string>;

export type ToastIcons = {
  close?: JSX.Element;
} & Record<ToastTypes, JSX.Element>;

export type Action = {
  label: JSX.Element;
  onClick: (event: MouseEvent) => void;
  actionButtonStyle?: JSX.CSSProperties;
};

export type ToastT = {
  id: number | string;
  title?: JSX.Element;
  type?: ToastTypes;
  icon?: JSX.Element;
  jsx?: JSX.Element;
  richColors?: boolean;
  invert?: boolean;
  closeButton?: boolean;
  dismissible?: boolean;
  description?: JSX.Element;
  duration?: number;
  delete?: boolean;
  action?: Action | JSX.Element;
  cancel?: Action | JSX.Element;
  onDismiss?: (toast: ToastT) => void;
  onAutoClose?: (toast: ToastT) => void;
  promise?: PromiseT;
  cancelButtonStyle?: JSX.CSSProperties;
  actionButtonStyle?: JSX.CSSProperties;
  style?: JSX.CSSProperties;
  unstyled?: boolean;
  className?: string;
  classNames?: ToastClassnames;
  descriptionClassName?: string;
  position?: Position;
};

export function isAction(action: Action | JSX.Element): action is Action {
  return !!action && (action as Action).label !== undefined;
}

export type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
export type HeightT = {
  height: number;
  toastId: number | string;
  position: Position;
};

type ToastOptions = {
  className?: string;
  closeButton?: boolean;
  descriptionClassName?: string;
  style?: JSX.CSSProperties;
  cancelButtonStyle?: JSX.CSSProperties;
  actionButtonStyle?: JSX.CSSProperties;
  duration?: number;
  unstyled?: boolean;
  classNames?: ToastClassnames;
  closeButtonAriaLabel?: string;
};

type Offset =
  | {
      top?: string | number;
      right?: string | number;
      bottom?: string | number;
      left?: string | number;
    }
  | string
  | number;

export type ToasterProps = {
  invert?: boolean;
  theme?: 'light' | 'dark' | 'system';
  position?: Position;
  hotkey?: string[];
  richColors?: boolean;
  expand?: boolean;
  duration?: number;
  gap?: number;
  visibleToasts?: number;
  closeButton?: boolean;
  toastOptions?: ToastOptions;
  className?: string;
  style?: JSX.CSSProperties;
  offset?: Offset;
  mobileOffset?: Offset;
  dir?: 'rtl' | 'ltr' | 'auto';
  swipeDirections?: SwipeDirection[];
  icons?: ToastIcons;
  containerAriaLabel?: string;
};

export type SwipeDirection = 'top' | 'right' | 'bottom' | 'left';

export type ToastProps = {
  toast: ToastT;
  toasts: ToastT[];
  index: number;
  swipeDirections?: SwipeDirection[];
  expanded: boolean;
  invert: boolean;
  removeToast: (toast: ToastT) => void;
  gap: number;
  position: Position;
  visibleToasts: number;
  expandByDefault: boolean;
  closeButton: boolean;
  interacting: boolean;
  style?: JSX.CSSProperties;
  cancelButtonStyle?: JSX.CSSProperties;
  actionButtonStyle?: JSX.CSSProperties;
  duration?: number;
  class?: string;
  unstyled?: boolean;
  descriptionClassName?: string;
  classNames?: ToastClassnames;
  icons?: ToastIcons;
  closeButtonAriaLabel?: string;
  defaultRichColors?: boolean;
};

export enum SwipeStateTypes {
  SwipedOut = 'SwipedOut',
  SwipedBack = 'SwipedBack',
  NotSwiped = 'NotSwiped',
}

export type Theme = 'light' | 'dark';

export type ToastToDismiss = {
  id: number | string;
  dismiss: boolean;
};

export type ExternalToast = Omit<ToastT, 'id' | 'type' | 'title' | 'jsx' | 'delete' | 'promise'> & {
  id?: number | string;
};
