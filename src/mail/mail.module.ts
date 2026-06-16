import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';

@Global() // Make it global so it can be used anywhere
@Module({
  providers: [MailService],
  exports: [MailService], // Export to use in other modules
})
export class MailModule {}
