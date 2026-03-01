import { Component } from '@angular/core';
import { Breadcrumb } from '../../breadcrumb/breadcrumb';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [Breadcrumb],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {}
