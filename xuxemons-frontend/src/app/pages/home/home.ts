import { Component, OnInit, signal, inject } from '@angular/core';
import { TrainerLvl } from '../../core/components/trainer-lvl/trainer-lvl';
import { WinStreakV1 } from '../../core/components/win-streak-v1/win-streak-v1';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TrainerLvl, WinStreakV1],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private auth = inject(AuthService);
  statsReady = signal(false);

  // Sirve para inicializar el componente
  ngOnInit(): void {
    this.auth.refreshUserFromApi().subscribe(u => {
      if (u) this.statsReady.set(true);
    });
  }
}
