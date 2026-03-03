import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-total-battles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './total-battles.html',
  styleUrl: './total-battles.css',
})
export class TotalBattles {
  user$ = inject(AuthService).user$;
}
