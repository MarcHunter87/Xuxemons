import { Component, OnInit, inject, signal } from '@angular/core';
import { XuxemonService } from '../../services/xuxemon.service';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class Collection implements OnInit {
  private xuxemonService = inject(XuxemonService);

  acquired = signal(0);
  total = signal(0);
  loading = signal(true);
  loadError = signal(false);

  // Sirve para inicializar el componente
  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    const stats = await this.xuxemonService.loadCollectionStats();
    if (stats) {
      this.acquired.set(stats.acquired);
      this.total.set(stats.total);
      this.loadError.set(false);
    } else {
      this.loadError.set(true);
    }
    this.loading.set(false);
  }
}
