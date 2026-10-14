import { Conversa } from './../../models/conversa';
import { Usuario } from './../../models/usuario';
import { Component, OnInit } from '@angular/core';

import { ConversaService } from './conversas.service';
import { Mensagem } from 'src/app/models/mensagem';

@Component({
  selector: 'app-conversas',
  templateUrl: './conversas.component.html',
  styleUrls: ['./conversas.component.scss']
})
export class ConversasComponent implements OnInit {

  usuarios!: Usuario[];

  conversas: Conversa[] = [];

  constructor(private conversaService: ConversaService) {}

  ngOnInit(): void {
    this.carregarConversas();
  }

  carregarConversas(): void {
    this.conversaService
      .listarConversas()
      .subscribe({
        next: usuarios => this.usuarios = usuarios,
        error: erro => console.error('Erro ao carregar conversas:', erro)
      });
  }

  formatarHora(data: string){
    return this.conversaService.formatarHora(data);
  }

  listarConversas(){
    return this.conversaService.listarConversas();
  }
}
