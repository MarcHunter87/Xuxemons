import { Injectable, signal } from '@angular/core';

export interface Xuxemon {
    id: number;
    name: string;
    type: { name: string };
    image_url: string;
}

@Injectable({
    providedIn: 'root'
})
export class XuxemonService {
    public readonly xuxemons = signal<Xuxemon[]>([
        {
            id: 1,
            name: 'Gore Magala',
            type: { name: 'Power' },
            image_url: 'http://localhost:8001/Xuxemons/Gore Magala.png'
        },
        {
            id: 2,
            name: 'Lagiacrus',
            type: { name: 'Speed' },
            image_url: 'http://localhost:8001/Xuxemons/Lagiacrus.png'
        },
        {
            id: 3,
            name: 'Seregios',
            type: { name: 'Technical' },
            image_url: 'http://localhost:8001/Xuxemons/Seregios.png'
        }
    ]);
}
