import { Conversa } from '../../models/conversa';
import { Usuario } from '../../models/usuario';
import { Component, OnInit } from '@angular/core';

import { MensagensService } from './mensagens.service';
import { Mensagem } from 'src/app/models/mensagem';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-conversas',
  templateUrl: './mensagens.component.html',
  styleUrls: ['./mensagens.component.scss']
})
export class MensagensComponent implements OnInit {

  usuario!: Usuario;

  usuarioId!: number;

  mensagens: Mensagem[] = [];

  novaMensagem = '';

  constructor(private route: ActivatedRoute, private mensagensService: MensagensService) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.usuarioId = Number(params.get('usuarioId'));
      this.carregarConversas();
    });
  }

  carregarConversas(): void {
  this.mensagensService
    .pesquisarConversasPorId(this.usuarioId)
    .subscribe({
      next: mensagens => {
        this.mensagens = mensagens;

        const participantes = mensagens[0]?.conversa?.usuarios ?? [];
        const outro = participantes.find(u => u.id === this.usuarioId);
        if (outro) {
          this.usuario = outro;
        }
      },
      error: erro => {
        console.error('Erro ao carregar mensagens:', erro.status, erro.error);
      }
    });
}

  formatarHora(data: string){
    return this.mensagensService.formatarHora(data);
  }

  enviar(){

    const conteudo = this.novaMensagem;
    if (!conteudo) return;

    this.mensagensService.enviar(conteudo, this.usuarioId)
      .subscribe({
        next: mensagem => {
          this.carregarConversas();
          this.novaMensagem = '';
        },
        error: erro => console.error('Erro ao enviar', erro.status, erro.error)
      });
  }
}
