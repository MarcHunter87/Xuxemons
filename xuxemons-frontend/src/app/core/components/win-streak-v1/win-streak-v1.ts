import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
    selector: 'app-win-streak-v1',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './win-streak-v1.html',
    styleUrl: './win-streak-v1.css'
})
export class WinStreakV1 {
    user$ = inject(AuthService).user$;
}
