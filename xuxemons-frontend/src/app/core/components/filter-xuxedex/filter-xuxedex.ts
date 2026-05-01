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

  // Sirve para manejar los cambios de los inputs
  ngOnChanges(): void {
    this.typeOptions = Array.from(
      new Set(this.xuxemons.map(xuxemon => xuxemon.type?.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    this.emitFilteredXuxemons();
  }

  // Sirve para aplicar la búsqueda al presionar Enter
  applySearchOnEnter(): void {
    this.appliedSearch = this.searchInput;
    this.emitFilteredXuxemons();
  }

  // Sirve para alternar el panel
  togglePanel(which: Exclude<FilterPanel, null>): void {
    this.openPanel.update((cur) => (cur === which ? null : which));
  }

  // Sirve para abrir el panel de tipo
  openTypeOnFocus(): void {
    this.openPanel.set('type');
  }

  // Sirve para abrir el panel de tamaño
  openSizeOnFocus(): void {
    this.openPanel.set('size');
  }

  // Sirve para cerrar los paneles
  closePanels(): void {
    this.openPanel.set(null);
  }

  // Sirve para manejar el foco fuera del panel
  onPanelFocusOut(event: FocusEvent, which: Exclude<FilterPanel, null>): void {
    const wrapper = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (!wrapper || (next && wrapper.contains(next))) return;
    if (this.openPanel() === which) this.closePanels();
  }

  // Sirve para aplicar el tipo
  commitType(value: string): void {
    this.appliedType = value;
    this.emitFilteredXuxemons();
  }

  // Sirve para aplicar el tipo y cerrar el panel
  commitTypeAndClose(value: string): void {
    this.commitType(value);
    this.closePanels();
  }

  // Sirve para aplicar el tamaño
  commitSize(value: string): void {
    this.appliedSize = value;
    this.emitFilteredXuxemons();
  }

  // Sirve para aplicar el tamaño y cerrar el panel
  commitSizeAndClose(value: string): void {
    this.commitSize(value);
    this.closePanels();
  }

  // Sirve para emitir los Xuxemons filtrados
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
