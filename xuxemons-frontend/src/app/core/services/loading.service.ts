import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendingRequests = signal(0);
  readonly isLoading = signal(false);

  // Sirve para iniciar el contador de solicitudes
  start(): void {
    const nextCount = this.pendingRequests() + 1;
    this.pendingRequests.set(nextCount);
    if (!this.isLoading()) {
      this.isLoading.set(true);
    }
  }

  // Sirve para detener el contador de solicitudes
  stop(): void {
    const currentCount = this.pendingRequests();
    const nextCount = currentCount > 0 ? currentCount - 1 : 0;
    this.pendingRequests.set(nextCount);
    if (nextCount === 0 && this.isLoading()) {
      this.isLoading.set(false);
    }
  }
}
