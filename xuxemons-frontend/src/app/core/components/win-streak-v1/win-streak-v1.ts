import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-win-streak-v1',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './win-streak-v1.html',
    styleUrl: './win-streak-v1.css'
})
export class WinStreakV1 {
    @Input() streak: number = 0;
}
