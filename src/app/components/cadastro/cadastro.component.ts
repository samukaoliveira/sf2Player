import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';

@Component({
  selector: 'app-cadastro',
  templateUrl: './cadastro.component.html',
  styleUrls: ['../login/login.component.scss']
})
export class CadastroComponent {
  nome = '';
  email = '';
  senha = '';
  confirmarSenha = '';
  message = '';
  enviando = false;

  constructor(private authService: AuthService, private router: Router) {}

  cadastrar(): void {
    this.message = '';

    if (this.senha !== this.confirmarSenha) {
      this.message = 'As senhas não coincidem.';
      return;
    }

    this.enviando = true;
    this.authService.cadastrar(this.nome, this.email, this.senha).subscribe({
      next: () => {
        this.enviando = false;
        this.router.navigate(['/login'], { queryParams: { cadastro: 'sucesso' } });
      },
      error: (err) => {
        this.enviando = false;
        this.message = err && err.status === 409
          ? 'Este email já está cadastrado.'
          : 'Não foi possível criar sua conta. Tente novamente.';
      }
    });
  }
}
