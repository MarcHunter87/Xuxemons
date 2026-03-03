import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-win-streak-v2',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './win-streak-v2.html',
  styleUrl: './win-streak-v2.css',
})
export class WinStreakV2 {
  user$ = inject(AuthService).user$;
}
