import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-trainer-lvl',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './trainer-lvl.html',
    styleUrl: './trainer-lvl.css'
})
export class TrainerLvl {
    @Input() level: number = 0;
    @Input() currentXp: number = 0;
    @Input() nextLevelXp: number = 1200;

    get progressPercentage(): number {
        return Math.min(100, Math.max(0, (this.currentXp / this.nextLevelXp) * 100));
    }
}
