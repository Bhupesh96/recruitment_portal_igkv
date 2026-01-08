import { Directive, ElementRef, HostListener, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appInputTooltip]',
  standalone: true,
})
export class InputTooltipDirective {
  private tooltip: HTMLElement | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('mouseenter') onMouseEnter() {
    const nativeEl = this.el.nativeElement;
    let displayValue = '';

    // Check if the element is a Dropdown (Select)
    if (nativeEl.tagName === 'SELECT') {
      const selectEl = nativeEl as HTMLSelectElement;
      // Get the text of the selected option (e.g., "Option Name")
      // instead of the value (e.g., "123")
      if (selectEl.selectedIndex !== -1) {
        displayValue = selectEl.options[selectEl.selectedIndex].text;
      }
    } else {
      // For Inputs and Textareas, simply get the value
      displayValue = nativeEl.value;
    }

    // Only show if there is text and it's not just whitespace
    if (!displayValue || displayValue.trim() === '') return;

    this.showTooltip(displayValue);
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.hideTooltip();
  }

  @HostListener('focus') onFocus() {
    this.hideTooltip();
  }

  private showTooltip(text: string) {
    if (this.tooltip) return;

    this.tooltip = this.renderer.createElement('div');
    const textNode = this.renderer.createText(text);
    this.renderer.appendChild(this.tooltip, textNode);

    const classes = [
      'fixed',
      'z-[9999]',
      'bg-gray-900',
      'text-white',
      'text-sm',
      'px-3',
      'py-2',
      'rounded-md',
      'shadow-xl',
      'max-w-xs',
      'break-words',
      'pointer-events-none',
      'transition-opacity',
      'duration-200',
    ];

    classes.forEach((c) => this.renderer.addClass(this.tooltip, c));

    const rect = this.el.nativeElement.getBoundingClientRect();

    // Position the tooltip
    this.renderer.setStyle(this.tooltip, 'top', `${rect.bottom + 5}px`);
    this.renderer.setStyle(this.tooltip, 'left', `${rect.left}px`);

    this.renderer.appendChild(document.body, this.tooltip);
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.renderer.removeChild(document.body, this.tooltip);
      this.tooltip = null;
    }
  }
}
