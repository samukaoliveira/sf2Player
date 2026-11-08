import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { KeyboardComponent } from './components/keyboard/keyboard.component';

const routes: Routes = [
  {
    path: 'synth',
    component: KeyboardComponent
  },
  {
    path: '',
    redirectTo: 'synth',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'synth'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
