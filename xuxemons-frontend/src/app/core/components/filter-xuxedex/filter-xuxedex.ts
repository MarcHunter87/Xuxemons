import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { XuxemonService } from '../../services/xuxemon.service';

@Component({
  selector: 'app-filter-xuxedex',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './filter-xuxedex.html',
  styleUrl: './filter-xuxedex.css',
})
export class FilterXuxedex {
  public xuxemonService = inject(XuxemonService);
}
