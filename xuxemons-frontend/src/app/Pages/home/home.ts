import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, tap } from 'rxjs';
import { AuthService, User } from '../../core/services/auth';
import { TrainerLvl } from '../../core/components/trainer-lvl/trainer-lvl';
import { WinStreakV1 } from '../../core/components/win-streak-v1/win-streak-v1';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TrainerLvl, WinStreakV1],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly authService = inject(AuthService);
  user$: Observable<User | null> = this.authService.user$;
}
