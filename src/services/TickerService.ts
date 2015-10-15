import { Observable, Subject } from '@reactivex/rxjs';
import { RxWebSocket } from './RxWebSocket';

export enum ConnectionStates {
  CONNECTING,
  CONNECTED,
  CLOSED,
  RETRYING
}

export interface TickerMessage {
  id: string,
  value: number,
  dt: number
}

export class TickerService {
  socket: RxWebSocket;
  connectionState = new Subject<ConnectionStates>();

  constructor(url: string, RxWebSocketCtor: { new(url:string): RxWebSocket } = RxWebSocket) {
    let socket = this.socket = new RxWebSocketCtor(url);
    const connectionState = this.connectionState;

    socket.didOpen = () => {
      connectionState.next(ConnectionStates.CONNECTED);
    };

    socket.willOpen = () => {
      connectionState.next(ConnectionStates.CONNECTING);
    }
  }

  getTicker(id: string): Observable<TickerMessage> {
    const socket = this.socket;

    return Observable.create(subscriber => {
      const msgSub = socket.out.filter(d => d.id === id)
        .subscribe(subscriber);

      socket.send({ id, type: 'sub' });

      return () => {
        socket.send({ id, type: 'unsub' });
        msgSub.unsubscribe();
      };
    })
    .retryWhen(errors => errors.switchLatest(err => {
      if(navigator.onLine) {
        return Observable.of(2).expand((delay, i) => {
          return Observable.of(100 + Math.pow(delay, i)).delay(delay);
        }).takeUntil(this.connectionState.filter(x => x === ConnectionStates.CONNECTED));
      } else {
        return Observable.fromEvent(window, 'online').take(1);
      }
    }));
  }
}