import { Component } from '@angular/core';
import { TrainerLvl } from '../../core/components/trainer-lvl/trainer-lvl';
import { WinStreakV1 } from '../../core/components/win-streak-v1/win-streak-v1';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TrainerLvl, WinStreakV1],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {}
