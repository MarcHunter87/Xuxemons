import { Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Xuxemon } from '../../services/xuxemon.service';

type FilterPanel = null | 'type' | 'size';

@Component({
  selector: 'app-filter-xuxedex',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './filter-xuxedex.html',
  styleUrl: './filter-xuxedex.css',
})
export class FilterXuxedex implements OnChanges {
  @Input() xuxemons: Xuxemon[] = [];
  @Output() filteredXuxemonsChange = new EventEmitter<Xuxemon[]>();

  searchInput = '';
  private appliedSearch = '';
  appliedType = '';
  appliedSize = '';

  readonly openPanel = signal<FilterPanel>(null);

  typeOptions: string[] = [];
  sizeOptions: Array<'Small' | 'Medium' | 'Large'> = ['Small', 'Medium', 'Large'];

  ngOnChanges(): void {
    this.typeOptions = Array.from(
      new Set(this.xuxemons.map(xuxemon => xuxemon.type?.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    this.emitFilteredXuxemons();
  }

  applySearchOnEnter(): void {
    this.appliedSearch = this.searchInput;
    this.emitFilteredXuxemons();
  }

  togglePanel(which: Exclude<FilterPanel, null>): void {
    this.openPanel.update((cur) => (cur === which ? null : which));
  }

  openTypeOnFocus(): void {
    this.openPanel.set('type');
  }

  openSizeOnFocus(): void {
    this.openPanel.set('size');
  }

  closePanels(): void {
    this.openPanel.set(null);
  }

  onPanelFocusOut(event: FocusEvent, which: Exclude<FilterPanel, null>): void {
    const wrapper = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (!wrapper || (next && wrapper.contains(next))) return;
    if (this.openPanel() === which) this.closePanels();
  }

  commitType(value: string): void {
    this.appliedType = value;
    this.emitFilteredXuxemons();
  }

  commitTypeAndClose(value: string): void {
    this.commitType(value);
    this.closePanels();
  }

  commitSize(value: string): void {
    this.appliedSize = value;
    this.emitFilteredXuxemons();
  }

  commitSizeAndClose(value: string): void {
    this.commitSize(value);
    this.closePanels();
  }

  private emitFilteredXuxemons(): void {
    const query = this.appliedSearch.trim().toLowerCase();
    const filtered = this.xuxemons.filter(xuxemon => {
      const matchesQuery = !query || (xuxemon.name || '').toLowerCase().includes(query);
      const matchesType = !this.appliedType || xuxemon.type?.name === this.appliedType;
      const matchesSize = !this.appliedSize || xuxemon.size === this.appliedSize;
      return matchesQuery && matchesType && matchesSize;
    });

    this.filteredXuxemonsChange.emit(filtered);
  }
}
