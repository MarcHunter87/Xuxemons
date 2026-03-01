import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Header } from './header/header';
import { Footer } from './footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit, OnDestroy {
  protected readonly showLayout = signal(true);
  private sub: { unsubscribe: () => void } | null = null;

  constructor(private router: Router) {}

  private updateShowLayout(): void {
    const url = this.router.url.split('?')[0];
    this.showLayout.set(url !== '/login' && url !== '/register');
  }

  ngOnInit(): void {
    this.updateShowLayout();
    this.sub = this.router.events.pipe(
      filter(e => e.constructor.name === 'NavigationEnd')
    ).subscribe(() => this.updateShowLayout());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
