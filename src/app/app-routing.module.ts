import { NgModule } from '@angular/core';
import { Routes, RouterModule, CanActivate } from '@angular/router';
import { ConversasComponent } from './components/conversas/conversas.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './auth.guard';
import { MensagensComponent } from './components/mensagens/mensagens.component';
import { KeyboardComponent } from './components/keyboard/keyboard.component';
import { CadastroComponent } from './components/cadastro/cadastro.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'cadastro',
    component: CadastroComponent
  },
  {
    path: 'synth',
    component: KeyboardComponent
  },
  {
    path: '',
    redirectTo: 'synth',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
