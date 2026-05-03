import { AfterViewChecked, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-battle-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './battle-footer.html',
  styleUrl: './battle-footer.css',
})
export class BattleFooter implements AfterViewChecked {
  // Sirve para recibir el view-model del combate desde el componente padre.
  @Input({ required: true }) vm!: any;

  @ViewChild('battleLogs') private battleLogsRef?: ElementRef<HTMLElement>;

  private lastLogFingerprint = '';

  // Sirve para actualizar el scroll del logs cuando se añaden nuevos logs.
  ngAfterViewChecked(): void {
    const vm = this.vm;
    if (!vm) {
      return;
    }

    const logs = vm.battleLog() as { text: string }[];
    const fingerprint = logs.map((entry) => entry.text).join('\u0001');
    if (fingerprint === this.lastLogFingerprint) {
      return;
    }

    this.lastLogFingerprint = fingerprint;
    const el = this.battleLogsRef?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
