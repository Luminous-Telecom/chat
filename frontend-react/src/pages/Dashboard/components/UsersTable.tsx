import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';
import type { UserDetail } from '../../../types/dashboard';

interface UsersTableProps {
  data: UserDetail[];
}

export default function UsersTable({ data }: UsersTableProps) {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  };

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Detalhamento por Usuário
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Usuário</TableCell>
              <TableCell align="right">Total de Atendimentos</TableCell>
              <TableCell align="right">Atendimentos Ativos</TableCell>
              <TableCell align="right">Tempo Médio de Resposta</TableCell>
              <TableCell align="right">Tempo Médio de Atendimento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((user) => (
              <TableRow key={user.id}>
                <TableCell component="th" scope="row">
                  {user.name}
                </TableCell>
                <TableCell align="right">
                  {user.totalTickets.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell align="right">
                  {user.activeTickets.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell align="right">
                  {formatTime(user.avgResponseTime)}
                </TableCell>
                <TableCell align="right">
                  {formatTime(user.avgResolutionTime)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
} 