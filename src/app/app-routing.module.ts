import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ConversasComponent } from './components/conversas/conversas.component';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './auth.guard';
import { MensagensComponent } from './components/mensagens/mensagens.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'conversas',
    component: ConversasComponent
  },
  {
    path: 'mensagens/:usuarioId',
    component: MensagensComponent
  },
  {
    path: '',
    redirectTo: 'conversas',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
