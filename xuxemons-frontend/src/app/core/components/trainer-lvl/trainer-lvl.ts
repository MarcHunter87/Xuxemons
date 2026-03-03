import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, type User } from '../../services/auth';

@Component({
    selector: 'app-trainer-lvl',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './trainer-lvl.html',
    styleUrl: './trainer-lvl.css'
})
export class TrainerLvl {
    user$ = inject(AuthService).user$;

    getLevel(user: User | null): number {
        return user?.level ?? 1;
    }

    getCurrentXp(user: User | null): number {
        return user?.xp ?? 0;
    }

    getNextLevelXp(user: User | null): number {
        return (user?.level ?? 1) * 100;
    }

    getProgressPercentage(user: User | null): number {
        const next = this.getNextLevelXp(user);
        if (!next) return 0;
        return Math.min(100, Math.max(0, (this.getCurrentXp(user) / next) * 100));
    }
}
