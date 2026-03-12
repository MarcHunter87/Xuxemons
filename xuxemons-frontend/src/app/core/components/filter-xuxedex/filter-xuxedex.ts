import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Xuxemon } from '../../services/xuxemon.service';

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

  searchQuery = '';
  selectedType = '';
  selectedSize = '';

  typeOptions: string[] = [];
  sizeOptions: Array<'Small' | 'Medium' | 'Large'> = ['Small', 'Medium', 'Large'];

  ngOnChanges(): void {
    this.typeOptions = Array.from(
      new Set(this.xuxemons.map(xuxemon => xuxemon.type?.name).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    this.emitFilteredXuxemons();
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.emitFilteredXuxemons();
  }

  onTypeChange(value: string): void {
    this.selectedType = value;
    this.emitFilteredXuxemons();
  }

  onSizeChange(value: string): void {
    this.selectedSize = value;
    this.emitFilteredXuxemons();
  }

  private emitFilteredXuxemons(): void {
    const query = this.searchQuery.trim().toLowerCase();
    const filtered = this.xuxemons.filter(xuxemon => {
      const matchesQuery = !query || (xuxemon.name || '').toLowerCase().includes(query);
      const matchesType = !this.selectedType || xuxemon.type?.name === this.selectedType;
      const matchesSize = !this.selectedSize || xuxemon.size === this.selectedSize;
      return matchesQuery && matchesType && matchesSize;
    });

    this.filteredXuxemonsChange.emit(filtered);
  }
}
