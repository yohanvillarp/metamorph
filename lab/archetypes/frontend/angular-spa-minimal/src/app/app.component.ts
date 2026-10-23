import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <div style="min-height: 100vh; font-family: system-ui, sans-serif">
      <nav style="padding: 1rem; border-bottom: 1px solid #e5e7eb; display: flex; gap: 1rem">
        <a routerLink="/">Home</a>
        <a routerLink="/about">About</a>
      </nav>
      <main style="padding: 2rem">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {}
