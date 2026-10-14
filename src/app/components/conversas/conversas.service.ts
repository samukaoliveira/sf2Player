import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Usuario } from '../../models/usuario';
import { Mensagem } from 'src/app/models/mensagem';
import { Conversa } from 'src/app/models/conversa';

@Injectable({
  providedIn: 'root'
})
export class ConversaService {

  private apiUrl = 'http://localhost:8080/conversas';

  constructor(private http: HttpClient) {}

  pesquisarConversasPorId(id: number): Observable<Mensagem[]> {
    return this.http.get<Mensagem[]>(
      `${this.apiUrl}/${id}`
    );
  }

  listarConversas(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(
      `${this.apiUrl}/listar`
    );
  }

  pesquisarConversasPorNome(nomeUsuario: string): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(
      `${this.apiUrl}`,
      { params: {
        nomeUsuario: nomeUsuario }
      }
    );
  }

  formatarHora(data: string): string {

    if (!data) {
      return '';
    }

    const [dataParte, horaParte] = data.split(' ');

    const [dia, mes, ano] = dataParte.split('/').map(Number);
    const [hora, minuto] = horaParte.split(':').map(Number);

    const dataMensagem = new Date(
      ano,
      mes - 1,
      dia,
      hora,
      minuto
    );

    const hoje = new Date();

    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    if (
      dataMensagem.getDate() === hoje.getDate() &&
      dataMensagem.getMonth() === hoje.getMonth() &&
      dataMensagem.getFullYear() === hoje.getFullYear()
    ) {
      return `hoje, ${horaParte.substring(0, 5)}`;
    }

    if (
      dataMensagem.getDate() === ontem.getDate() &&
      dataMensagem.getMonth() === ontem.getMonth() &&
      dataMensagem.getFullYear() === ontem.getFullYear()
    ) {
      return `ontem, ${horaParte.substring(0, 5)}`;
    }

    return `${dataParte}, ${horaParte.substring(0, 5)}`;
  }
}
