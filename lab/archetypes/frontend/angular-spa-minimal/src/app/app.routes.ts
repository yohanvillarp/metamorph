import { Routes } from '@angular/router';
import { HomeComponent } from './routes/home.component';
import { AboutComponent } from './routes/about.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'about', component: AboutComponent },
];
