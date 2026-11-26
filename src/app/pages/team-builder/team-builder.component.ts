import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamPresetsComponent } from '../../shared/team-presets.component';
import { IconComponent } from '../../shared/icon.component';
import { PlacementComponent } from '../../battle/placement/placement.component';
import { FormationArchiveComponent } from './formation-archive.component';
import { TeamBuilderLayout } from './team-builder-layout';

/** Persistent formation editor; stage-specific enemy previews belong to battle preparation. */
@Component({
  selector: 'app-team-builder',
  imports: [CitadelFrameComponent, PlacementComponent, RouterLink, TeamPresetsComponent, IconComponent, FormationArchiveComponent],
  templateUrl: './team-builder.component.html',
  styleUrl: './team-builder.component.scss',
})
export class TeamBuilderComponent {
  readonly desktopArchive = inject(TeamBuilderLayout).desktop;
}
